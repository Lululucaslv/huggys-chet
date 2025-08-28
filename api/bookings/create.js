import { getServiceSupabase } from '../_utils/supabaseServer.js'

export const runtime = 'nodejs'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const { therapistCode, startUTC, durationMins, userId } = body
    if (!therapistCode || !startUTC || !durationMins || !userId) {
      res.status(400).json({ error: 'therapistCode, startUTC, durationMins, userId required' })
      return
    }

    const supabase = getServiceSupabase()
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
    res.status(500).json({ error: e.message || 'create booking failed' })
  }
}
