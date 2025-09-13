import { getServiceSupabase } from '../_utils/supabaseServer.js'
import { DateTime } from 'luxon'

export const runtime = 'nodejs'

function withCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function fmtDisplay(iso, tz) {
  if (!iso) return ''
  const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone(tz || 'UTC')
  const pretty = dt.toFormat('LLL dd (ccc) HH:mm')
  const abbr = dt.toFormat('ZZZ')
  return `${pretty} ${abbr}`
}

export default async function handler(req, res) {
  withCors(res)
  try {
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS')
      return res.status(405).json({ error: 'Method not allowed' })
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const { booking_id, new_availability_id, user_tz = 'UTC' } = body
    if (!booking_id || !new_availability_id) return res.status(400).json({ error: 'booking_id and new_availability_id required' })

    const supabase = getServiceSupabase()

    const { data: slot, error: e1 } = await supabase
      .from('therapist_availability')
      .select('id, therapist_code, start_utc, end_utc, booked')
      .eq('id', new_availability_id)
      .eq('booked', false)
      .single()
    if (e1 || !slot) return res.status(409).json({ error: 'slot_unavailable' })

    const { data: bk, error: e2 } = await supabase
      .from('bookings')
      .select('id, therapist_code')
      .eq('id', booking_id)
      .single()
    if (e2 || !bk) return res.status(404).json({ error: 'booking_not_found' })

    if (bk.therapist_code !== slot.therapist_code) return res.status(400).json({ error: 'therapist_mismatch' })

    await supabase.from('therapist_availability').update({ booked: true }).eq('id', slot.id)

    const durMins = Math.max(1, Math.round((new Date(slot.end_utc) - new Date(slot.start_utc)) / 60000))
    const { data: updated, error: e3 } = await supabase
      .from('bookings')
      .update({ start_utc: slot.start_utc, duration_mins: durMins })
      .eq('id', booking_id)
      .select()
      .single()
    if (e3) return res.status(500).json({ error: 'update_failed' })

    const resp = {
      booking_id: updated.id,
      therapist_code: updated.therapist_code,
      startUTC: updated.start_utc,
      endUTC: DateTime.fromISO(updated.start_utc, { zone: 'utc' }).plus({ minutes: updated.duration_mins }).toISO(),
      timeZone: 'UTC',
      display: fmtDisplay(updated.start_utc, user_tz || 'UTC'),
    }
    return res.status(200).json({ ok: true, data: resp })
  } catch (e) {
    return res.status(500).json({ error: 'exception' })
  }
}
