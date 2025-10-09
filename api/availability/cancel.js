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
    const { availability_id, therapist_code, user_id, tz, lang } = body

    if (!availability_id || !therapist_code) {
      return res.status(400).json({ error: 'availability_id_and_therapist_code_required' })
    }

    const supabase = getServiceSupabase()

    const { data, error } = await supabase
      .from('therapist_availability')
      .delete()
      .eq('id', availability_id)
      .eq('therapist_code', therapist_code)
      .select()

    if (error) {
      console.error('Failed to delete availability:', error)
      return res.status(500).json({ error: 'delete_failed', details: error.message })
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'slot_not_found_or_therapist_code_mismatch' })
    }

    return res.status(200).json({ ok: true, data })
  } catch (e) {
    console.error('Cancel availability error:', e)
    return res.status(500).json({ error: e?.message || 'server_error' })
  }
}
