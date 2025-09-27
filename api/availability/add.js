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

    const supabase = getServiceSupabase()
    const raw = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const therapist_code = raw.therapist_code ?? raw.therapistCode
    const tzAll = raw.tz ?? raw.user_tz ?? 'UTC'
    const user_tz = raw.user_tz ?? tzAll

    const localRanges = Array.isArray(raw.time_ranges) ? raw.time_ranges : []
    const utcRanges = Array.isArray(raw.utc_ranges) ? raw.utc_ranges : (Array.isArray(raw.time_ranges) ? raw.time_ranges : [])

    if (!therapist_code || (!localRanges.length && !utcRanges.length)) {
      return res.status(400).json({ error: 'therapist_code and time_ranges required' })
    }

    const { data: th } = await supabase.from('therapists').select('id, code').eq('code', therapist_code).maybeSingle()
    const therapist_id = th?.id ?? therapist_code

    const ranges = localRanges.some(r => r && r.start_local)
      ? localRanges.map(r => ({
          start: toUTC(r.start_local, r.tz || tzAll),
          end: toUTC(r.end_local, r.tz || tzAll),
        }))
      : utcRanges.map(r => ({
          start: r.start ? new Date(r.start).toISOString() : null,
          end: r.end ? new Date(r.end).toISOString() : null,
        }))

    const invalids = []
    const inserts = []
    for (const r of ranges) {
      if (!r.start || !r.end) {
        invalids.push({ r, reason: 'invalid_range' })
        continue
      }
      if (new Date(r.start) >= new Date(r.end)) {
        invalids.push({ r, reason: 'start>=end' })
        continue
      }
      inserts.push({ therapist_id, start_time: r.start, end_time: r.end, is_booked: false })
    }
    if (!inserts.length) return res.status(400).json({ error: 'no valid ranges', invalids })

    const { data, error } = await supabase.from('availability').insert(inserts, { upsert: false }).select()
    if (error) {
      if ((error.code || '').toString() === '23505') {
        return res.status(200).json({ ok: true, data: [], conflicts: true, invalids })
      }
      return res.status(500).json({ error: 'insert_failed', details: error.message })
    }

    const response = (data || []).map(s => ({
      availabilityId: s.id,
      therapistId: s.therapist_id,
      startUTC: s.start_time,
      endUTC: s.end_time,
      timeZone: tzAll,
      display: fmtDisplay(s.start_time, user_tz || tzAll),
    }))
    return res.status(200).json({ ok: true, data: response, invalids: invalids.length ? invalids : undefined })
  } catch (e) {
    return res.status(500).json({ error: 'exception' })
  }
}
