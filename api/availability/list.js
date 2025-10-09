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
      return res.status(200).end()
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS')
      return res.status(405).json({ error: 'method_not_allowed' })
    }

    const authHeader = req.headers['authorization'] || req.headers['Authorization']
    const rawToken = typeof authHeader === 'string' ? authHeader : ''
    const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken
    if (!token) return res.status(401).json({ error: 'unauthorized' })

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const { therapist_code, user_id, lang, tz } = body

    if (!therapist_code) {
      return res.status(400).json({ error: 'therapist_code_required' })
    }

    const supabase = getServiceSupabase()

    const { data: slots, error } = await supabase
      .from('therapist_availability')
      .select('id, therapist_code, start_utc, end_utc, booked')
      .eq('therapist_code', therapist_code)
      .or('booked.is.null,booked.eq.false')
      .gte('start_utc', new Date().toISOString())
      .order('start_utc', { ascending: true })

    if (error) {
      console.error('Failed to fetch availability:', error)
      return res.status(500).json({ error: 'fetch_failed', details: error.message })
    }

    const data = (slots || []).map((slot) => ({
      availabilityId: slot.id,
      id: slot.id,
      therapistCode: slot.therapist_code,
      startUTC: slot.start_utc,
      endUTC: slot.end_utc,
      tz_used: tz || 'UTC',
      timeZone: tz || 'UTC',
      status: slot.booked ? 'booked' : 'open',
      repeat: null,
      weekdays: [],
      source: 'api',
    }))

    return res.status(200).json({ 
      ok: true, 
      data,
      meta: { 
        therapist_code, 
        user_id, 
        lang, 
        tz,
        count: data.length 
      } 
    })
  } catch (e) {
    console.error('List availability error:', e)
    return res.status(500).json({ error: e?.message || 'server_error' })
  }
}
