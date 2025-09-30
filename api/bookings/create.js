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
    let therapistProfileId = null
    try {
      const { data: th } = await supabase.from('therapists').select('user_id,code').eq('code', therapistCode).maybeSingle()
      if (th?.user_id) {
        const { data: prof } = await supabase.from('user_profiles').select('id').eq('user_id', th.user_id).maybeSingle()
        therapistProfileId = prof?.id || null
      } else if (/^[0-9a-fA-F-]{36}$/.test(String(therapistCode))) {
        therapistProfileId = therapistCode
      }
    } catch {}

    if (availabilityId) {
      const availIdNum = Number(availabilityId)
      const idFilter = Number.isFinite(availIdNum) ? availIdNum : availabilityId
      const tryLegacy = async () => {
        let updated = null
        let updErr = null
        const pre = await supabase
          .from('availability')
          .select('id,is_booked,start_time,end_time')
          .eq('id', idFilter)
          .maybeSingle()
        {
          const resp = await supabase
            .from('availability')
            .update({ is_booked: true })
            .eq('id', idFilter)
            .eq('is_booked', false)
            .select('id, therapist_id, start_time, end_time')
            .maybeSingle()
          updated = resp.data || null
          updErr = resp.error || null
        }
        if (!updated && !updErr) {
          const resp2 = await supabase
            .from('availability')
            .update({ is_booked: true })
            .eq('id', idFilter)
            .is('is_booked', null)
            .select('id, therapist_id, start_time, end_time')
            .maybeSingle()
          updated = resp2.data || null
          updErr = resp2.error || null
        }
        if (updErr || !updated) {
          const post = await supabase
            .from('availability')
            .select('id,is_booked')
            .eq('id', idFilter)
            .maybeSingle()
          res.status(409).json({
            error: 'slot_unavailable',
            detail: updErr?.message || null,
            pre: pre?.data || null,
            post: post?.data || null
          })
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
        const baseInsert = {
          therapist_code: therapistCode,
          start_utc: updated.start_time,
          session_date: new Date(updated.start_time).toISOString().slice(0, 10),
          duration_mins: duration,
          user_id: userId,
          client_user_id: userId,
          status: 'confirmed',
        }
        const { data: booking, error: insErr } = await supabase
          .from('bookings')
          .insert(baseInsert)
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

      const handled = await tryLegacy()
      if (handled) return
      res.status(409).json({ error: 'slot_unavailable' })
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

    const baseInsert = {
      therapist_code: therapistCode,
      start_utc: startUTC,
      session_date: new Date(startUTC).toISOString().slice(0, 10),
      duration_mins: durationMins,
      user_id: userId,
      client_user_id: userId,
      status: 'confirmed',
    }
    if (therapistProfileId) baseInsert.therapist_id = therapistProfileId
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert(baseInsert)
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
