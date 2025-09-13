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
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS')
      return res.status(405).json({ error: 'Method not allowed' })
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const { booking_id, reason } = body
    if (!booking_id) return res.status(400).json({ error: 'booking_id required' })

    const supabase = getServiceSupabase()
    const { data: bk, error } = await supabase.from('bookings').select('id, therapist_code').eq('id', booking_id).single()
    if (error || !bk) return res.status(404).json({ error: 'booking_not_found' })

    const { error: e2 } = await supabase.from('bookings').update({ status: 'canceled', cancel_reason: reason || null }).eq('id', booking_id)
    if (e2) return res.status(500).json({ error: 'cancel_failed' })

    return res.status(200).json({ ok: true, data: { booking_id, status: 'canceled' } })
  } catch (e) {
    return res.status(500).json({ error: 'exception' })
  }
}
