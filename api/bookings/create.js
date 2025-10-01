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
      const { data: booked, error: rpcErr } = await supabase.rpc('book_from_slot', {
        p_availability_id: availabilityId,
        p_user_id: userId,
        p_therapist_code: therapistCode,
      })
      if (rpcErr) {
        const msg = (rpcErr.message || '').toLowerCase()
        if (msg.includes('slot_unavailable')) {
          res.status(409).json({ error: 'slot_unavailable' })
          return
        }
        res.status(500).json({ error: 'booking_failed' })
        return
      }
      if (!booked || !booked.id) {
        res.status(500).json({ error: 'booking_failed' })
        return
      }
      res.status(200).json({ booking: booked })
      return
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
