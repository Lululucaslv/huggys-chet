import { getServiceSupabase } from '../_utils/supabaseServer.js'
import { DateTime } from 'luxon'

export const runtime = 'nodejs'

function withCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function toUTC(local, tz) {
  if (!local) return null
  return DateTime.fromFormat(local, 'yyyy-MM-dd HH:mm', { zone: tz || 'UTC' }).toUTC().toISO()
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
    const { therapist_code, time_ranges = [], tz = 'UTC', user_tz = 'UTC' } = body
    if (!therapist_code || !Array.isArray(time_ranges) || time_ranges.length === 0) {
      return res.status(400).json({ error: 'therapist_code and time_ranges required' })
    }

    const supabase = getServiceSupabase()
    const inserts = []
    for (const r of time_ranges) {
      let startUTC = null
      let endUTC = null

      if (r.start && r.end) {
        try {
          const s = DateTime.fromISO(r.start, { zone: 'utc' }).toUTC().toISO()
          const e = DateTime.fromISO(r.end, { zone: 'utc' }).toUTC().toISO()
          startUTC = s
          endUTC = e
        } catch (_) {}
      }

      if ((!startUTC || !endUTC) && (r.start_local || r.end_local)) {
        startUTC = toUTC(r.start_local, r.tz || tz)
        endUTC = toUTC(r.end_local, r.tz || tz)
      }

      if (!startUTC || !endUTC) continue
      inserts.push({ therapist_code, start_utc: startUTC, end_utc: endUTC, status: 'open' })
    }
    if (!inserts.length) return res.status(400).json({ error: 'no valid ranges' })

    const { data, error } = await supabase.from('therapist_availability').insert(inserts).select()
    if (error) return res.status(500).json({ error: 'insert_failed' })

    const response = (data || []).map(s => ({
      availabilityId: s.id,
      therapistCode: s.therapist_code,
      startUTC: s.start_utc,
      endUTC: s.end_utc,
      timeZone: tz,
      display: fmtDisplay(s.start_utc, user_tz || tz),
    }))
    return res.status(200).json({ ok: true, data: response })
  } catch (e) {
    return res.status(500).json({ error: 'exception' })
  }
}
