import { getServiceSupabase, getAuthUserIdFromRequest } from '../../api/_utils/supabaseServer.js'

export const runtime = 'nodejs'

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const supabase = getServiceSupabase()
    let uid
    try {
      uid = await getAuthUserIdFromRequest(req, supabase)
    } catch (e) {
      res.status(e.code || 401).json({ error: e.message || 'Unauthorized' })
      return
    }

    const [{ data: th, error: thErr }, { data: up, error: upErr }] = await Promise.all([
      supabase.from('therapists').select('user_id, name, verified').eq('user_id', uid).maybeSingle(),
      supabase.from('user_profiles').select('user_id, display_name').eq('user_id', uid).maybeSingle(),
    ])

    if (thErr) {
      res.status(400).json({ error: thErr.message })
      return
    }
    if (upErr) {
      res.status(400).json({ error: upErr.message })
      return
    }

    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ success: true, therapist: th || null, user_profile: up || null })
  } catch (e) {
    res.status(500).json({ error: e.message || 'Unexpected error' })
  }
}
