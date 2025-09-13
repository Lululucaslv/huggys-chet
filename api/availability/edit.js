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
    const { availabilityId, start_local, end_local, tz = 'UTC', user_tz = 'UTC' } = body
    if (!availabilityId) return res.status(400).json({ error: 'availabilityId required' })

    const supabase = getServiceSupabase()
    const patch = {}
    if (start_local) patch.start_utc = toUTC(start_local, tz)
    if (end_local) patch.end_utc = toUTC(end_local, tz)

    const { data, error } = await supabase
      .from('therapist_availability')
      .update(patch)
      .eq('id', availabilityId)
      .select()
      .single()

    if (error || !data) return res.status(404).json({ error: 'not_found' })

    const resp = {
      availabilityId: data.id,
      therapistCode: data.therapist_code,
      startUTC: data.start_utc,
      endUTC: data.end_utc,
      timeZone: tz,
      display: fmtDisplay(data.start_utc, user_tz || tz),
    }
    return res.status(200).json({ ok: true, data: resp })
  } catch (e) {
    return res.status(500).json({ error: 'exception' })
  }
}
