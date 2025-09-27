import { getServiceSupabase } from '../_utils/supabaseServer.js'

export const runtime = 'nodejs'

function withCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export default async function handler(req, res) {
  withCors(res)
  try {
    if (req.method === 'OPTIONS') {
      res.status(200).end()
      return
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS')
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const { therapistCode, startUTC, durationMins, userId, availabilityId, idempotencyKey } = body
    if (!userId || !therapistCode || (!availabilityId && (!startUTC || !durationMins))) {
      res.status(400).json({ error: 'therapistCode, userId and either availabilityId or (startUTC,durationMins) are required' })
      return
    }

    const supabase = getServiceSupabase()

    if (availabilityId) {
      const tryLegacy = async () => {
        const { data: updated, error: updErr } = await supabase
          .from('availability')
          .update({ is_booked: true })
          .eq('id', availabilityId)
          .or('is_booked.is.null,is_booked.eq.false')
          .select('id, therapist_id, start_time, end_time')
          .single()
        if (updErr || !updated) {
          res.status(409).json({ error: 'slot_unavailable' })
          return true
        }
        const duration = Math.max(1, Math.round((new Date(updated.end_time).getTime() - new Date(updated.start_time).getTime()) / 60000))
        const { data: dup } = await supabase
          .from('bookings')
          .select('id')
          .eq('user_id', userId)
          .eq('therapist_code', therapistCode)
          .eq('start_utc', updated.start_time)
          .eq('status', 'confirmed')
          .maybeSingle()
        if (dup) {
          res.status(200).json({ booking: dup })
          return true
        }
        const { data: booking, error: insErr } = await supabase
          .from('bookings')
          .insert({
            therapist_code: therapistCode,
            start_utc: updated.start_time,
            duration_mins: duration,
            user_id: userId,
            status: 'confirmed',
          })
          .select()
          .single()
        if (insErr) {
          res.status(500).json({ error: insErr.message || 'insert_failed' })
          return true
        }
        await supabase.from('chat_messages').insert({
          booking_id: booking.id,
          user_id: booking.user_id,
          role: 'system',
          message: JSON.stringify({
            type: 'BOOKING_SUCCESS',
            bookingId: booking.id,
            therapistCode: booking.therapist_code,
            startUTC: booking.start_utc,
            durationMins: booking.duration_mins,
            userId: booking.user_id,
          }),
        })
        res.status(200).json({ booking })
        return true
      }

      try {
        const { data: booked, error: rpcErr } = await supabase.rpc('book_from_slot', {
          p_availability_id: availabilityId,
          p_user_id: userId,
          p_therapist_code: therapistCode,
        })
        if (rpcErr) {
          const msg = (rpcErr.message || '').toLowerCase()
          const legacyMode = (process.env.SCHEMA_MODE || 'legacy').toLowerCase() !== 'new'
          if (msg.includes('slot_unavailable') && legacyMode) {
            const handled = await tryLegacy()
            if (handled) return
          }
          if (msg.includes('slot_unavailable')) {
            res.status(409).json({ error: 'slot_unavailable' })
            return
          }
          throw rpcErr
        }
        res.status(200).json({ booking: booked })
        return
      } catch {
        const legacyMode = (process.env.SCHEMA_MODE || 'legacy').toLowerCase() !== 'new'
        if (legacyMode) {
          const handled = await tryLegacy()
          if (handled) return
        }
        res.status(500).json({ error: 'rpc_failed' })
        return
      }
    }

    const { data: dup } = await supabase
      .from('bookings')
      .select('id')
      .eq('user_id', userId)
      .eq('therapist_code', therapistCode)
      .eq('start_utc', startUTC)
      .eq('status', 'confirmed')
      .maybeSingle()
    if (dup) {
      res.status(200).json({ booking: dup })
      return
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        therapist_code: therapistCode,
        start_utc: startUTC,
        duration_mins: durationMins,
        user_id: userId,
        status: 'confirmed',
      })
      .select()
      .single()
    if (error) throw error

    await supabase.from('chat_messages').insert({
      booking_id: booking.id,
      user_id: booking.user_id,
      role: 'system',
      message: JSON.stringify({
        type: 'BOOKING_SUCCESS',
        bookingId: booking.id,
        therapistCode: booking.therapist_code,
        startUTC: booking.start_utc,
        durationMins: booking.duration_mins,
        userId: booking.user_id,
      }),
    })

    res.status(200).json({ booking })
  } catch (e) {
    if ((e.message || '').toLowerCase().includes('slot_unavailable')) {
      res.status(409).json({ error: 'slot_unavailable' })
      return
    }
    res.status(500).json({ error: e.message || 'create booking failed' })
  }
}
