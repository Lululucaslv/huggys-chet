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
    if (req.method === 'OPTIONS') {
      res.status(200).end()
      return
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS')
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const supabase = getServiceSupabase()
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const {
      therapistHint = '',
      timeHint = '',
      lang = 'zh-CN',
      hours = 96,
      limit = 8,
      userId = null,
      user_tz = 'UTC',
    } = body

    let therapistCode = process.env.THERAPIST_DEFAULT_CODE || null

    if (therapistHint && String(therapistHint).trim()) {
      const { data: ths } = await supabase
        .from('therapists')
        .select('code,name,aliases,active')
        .ilike('name', `%${therapistHint}%`)
        .limit(1)
      if (ths && ths.length > 0) {
        therapistCode = ths[0].code
      } else {
        const { data: th2 } = await supabase
          .from('therapists')
          .select('code,aliases,active')
          .contains('aliases', [therapistHint])
          .limit(1)
        if (th2 && th2.length > 0) therapistCode = th2[0].code
      }
    }

    const now = new Date()
    const end = new Date(now.getTime() + Number(hours || 96) * 3600 * 1000)
    const startISO = now.toISOString()
    const endISO = end.toISOString()

    const tCode = therapistCode || body?.therapist_code || body?.therapistCode || body?.therapistHint || ''

    let q = supabase
      .from('availability')
      .select('id,therapist_id,start_time,end_time,is_booked')
      .or('is_booked.is.null,is_booked.eq.false')
      .gte('start_time', startISO)
      .lte('start_time', endISO)
      .order('start_time', { ascending: true })
      .limit(Number(limit || 8))

    if (tCode) {
      q = q.eq('therapist_id', tCode)
    }

    const { data: slots, error } = await q
    if (error) {
      res.status(500).json({ ok: false, error: 'list_failed' })
      return
    }

    const data = (slots || []).map(s => {
      const tz = user_tz || 'UTC'
      return {
        availabilityId: s.id,
        therapistId: s.therapist_id,
        startUTC: s.start_time,
        endUTC: s.end_time,
        timeZone: tz,
        display: fmtDisplay(s.start_time, tz),
      }
    })

    res.status(200).json({ ok: true, data, meta: { therapistCode, lang, timeHint, userId, user_tz } })
  } catch (e) {
    res.status(500).json({ ok: false, error: 'exception' })
  }
}
