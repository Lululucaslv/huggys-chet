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
      return res.status(405).json({ error: 'method_not_allowed' })
    }

    const authHeader = req.headers['authorization'] || req.headers['Authorization']
    const rawToken = typeof authHeader === 'string' ? authHeader : ''
    const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken
    if (!token) return res.status(401).json({ error: 'unauthorized' })

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    let { therapist_code, time_ranges = [], tz, user_id, lang, user_tz } = body

    if (!therapist_code || !Array.isArray(time_ranges) || time_ranges.length === 0) {
      return res.status(400).json({ error: 'therapist_code_and_time_ranges_required' })
    }

    const normalizeTz = (z) => {
      if (!z) return 'UTC'
      if (z === 'America/San Jose') return 'America/Los_Angeles'
      return z
    }
    tz = normalizeTz(tz)
    user_tz = normalizeTz(user_tz || tz)

    const nowUtc = DateTime.utc()
    const supabase = getServiceSupabase()

    const inserts = []
    const auditLocals = []
    for (const r of time_ranges) {
      let startUTC = null
      let endUTC = null
      let startLocalStr = null
      let endLocalStr = null

      if (r.start && r.end) {
        try {
          const s = DateTime.fromISO(r.start, { zone: 'utc' }).toUTC()
          const e = DateTime.fromISO(r.end, { zone: 'utc' }).toUTC()
          if (s.isValid && e.isValid) {
            startUTC = s.toISO()
            endUTC = e.toISO()
            startLocalStr = r.start
            endLocalStr = r.end
          }
        } catch (_) {}
      }

      if ((!startUTC || !endUTC) && (r.start_local && r.end_local)) {
        const s = DateTime.fromFormat(r.start_local, 'yyyy-MM-dd HH:mm', { zone: tz }).toUTC()
        const e = DateTime.fromFormat(r.end_local, 'yyyy-MM-dd HH:mm', { zone: tz }).toUTC()
        if (s.isValid && e.isValid) {
          startUTC = s.toISO()
          endUTC = e.toISO()
          startLocalStr = r.start_local
          endLocalStr = r.end_local
        }
      }

      if (!startUTC || !endUTC) continue
      const sUtc = DateTime.fromISO(startUTC, { zone: 'utc' }).toUTC()
      const eUtc = DateTime.fromISO(endUTC, { zone: 'utc' }).toUTC()
      if (!sUtc.isValid || !eUtc.isValid) continue
      if (sUtc.toMillis() <= nowUtc.toMillis()) continue
      if (eUtc.toMillis() <= sUtc.toMillis()) continue

      inserts.push({ therapist_code, start_utc: startUTC, end_utc: endUTC })
      auditLocals.push({ start_local: startLocalStr, end_local: endLocalStr })
    }

    for (const r of inserts) {
      const overlap = await supabase
        .from('therapist_availability')
        .select('id', { count: 'exact', head: true })
        .eq('therapist_code', r.therapist_code)
        .lt('start_utc', r.end_utc)
        .gt('end_utc', r.start_utc)

      if (overlap?.error) break
      if (typeof overlap?.count === 'number' && overlap.count > 0) {
        return res.status(409).json({ error: 'slot_overlap' })
      }
    }

    if (!inserts.length) return res.status(400).json({ error: 'no_valid_future_ranges' })

    const payloadsStatusFull = inserts.map((r, i) => ({
      therapist_code: r.therapist_code,
      start_utc: r.start_utc,
      end_utc: r.end_utc,
      status: 'open',
      tz,
      start_local: auditLocals[i]?.start_local || null,
      end_local: auditLocals[i]?.end_local || null,
      created_by: user_id || null
    }))
    const payloadsStatus = inserts.map((r) => ({
      therapist_code: r.therapist_code,
      start_utc: r.start_utc,
      end_utc: r.end_utc,
      status: 'open'
    }))
    const payloadsBooked = inserts.map((r) => ({
      therapist_code: r.therapist_code,
      start_utc: r.start_utc,
      end_utc: r.end_utc,
      booked: false
    }))

    let data = null
    let error = null

    let resp = await supabase.from('therapist_availability').insert(payloadsStatusFull).select()
    if (resp.error) {
      resp = await supabase.from('therapist_availability').insert(payloadsStatus).select()
    }
    if (resp.error) {
      resp = await supabase.from('therapist_availability').insert(payloadsBooked).select()
    }
    data = resp.data
    error = resp.error

    if (!data || error) {
      const msg = (error && (error.message || error.details || error.code || '')) || ''
      const m = String(msg).toLowerCase()
      if (m.includes('no_overlap_per_therapist') || m.includes('overlap') || m.includes('&&') || m.includes('duplicate key value violates unique constraint')) {
        return res.status(409).json({ error: 'slot_overlap' })
      }
      return res.status(500).json({ error: 'insert_failed' })
    }

    const response = (data || []).map((s, i) => ({
      availabilityId: s.id,
      therapistCode: s.therapist_code,
      tz_used: tz,
      timeZone: tz,
      startUTC: s.start_utc,
      endUTC: s.end_utc,
      start_local_canonical: auditLocals[i]?.start_local || null,
      end_local_canonical: auditLocals[i]?.end_local || null,
      display: fmtDisplay(s.start_utc, user_tz),
    }))
    return res.status(200).json({ ok: true, data: response })
  } catch (e) {
    return res.status(400).json({ error: e?.message || 'bad_request' })
  }
}
