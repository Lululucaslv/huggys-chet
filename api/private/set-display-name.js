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

    const { data: th, error: thSelErr } = await supabase
      .from('therapists')
      .select('user_id')
      .eq('user_id', uid)
      .maybeSingle()

    if (thSelErr) {
      res.status(400).json({ error: thSelErr.message })
      return
    }

    if (th) {
      const { error: updErr } = await supabase
        .from('therapists')
        .update({ name, verified: true })
        .eq('user_id', uid)
      if (updErr) {
        res.status(400).json({ error: updErr.message })
        return
      }
    } else {
      const { error: insErr } = await supabase
        .from('therapists')
        .insert({ user_id: uid, name, verified: true, specialization: 'General' })
      if (insErr) {
        res.status(400).json({ error: insErr.message })
        return
      }
    }

    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message || 'Unexpected error' })
  }
}
