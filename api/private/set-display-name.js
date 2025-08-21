import { getServiceSupabase, getAuthUserIdFromRequest } from '../../api/_utils/supabaseServer.js'

export const runtime = 'nodejs'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
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

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const name = String(body.name || '').trim()
    if (!name) {
      res.status(400).json({ error: 'Name is required' })
      return
    }

    const { error: upsertErr } = await supabase
      .from('therapists')
      .upsert({ user_id: uid, name, verified: true }, { onConflict: 'user_id' })

    if (upsertErr) {
      res.status(400).json({ error: upsertErr.message })
      return
    }

    await supabase
      .from('user_profiles')
      .update({ display_name: name })
      .eq('user_id', uid)

    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message || 'Unexpected error' })
  }
}
