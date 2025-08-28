import { getServiceSupabase } from '../_utils/supabaseServer.js'

export const runtime = 'nodejs'

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    const therapistCode = String(req.query.therapistCode || '')
    if (!therapistCode) {
      res.status(400).json({ error: 'therapistCode required' })
      return
    }
    const supabase = getServiceSupabase()
    const { data, error } = await supabase
      .from('bookings')
      .select('id,start_utc,duration_mins,status,user_id')
      .eq('therapist_code', therapistCode)
      .eq('status', 'confirmed')
      .order('start_utc', { ascending: true })
    if (error) throw error
    res.status(200).json({ bookings: data || [] })
  } catch (e) {
    res.status(500).json({ error: e.message || 'list bookings failed' })
  }
}
