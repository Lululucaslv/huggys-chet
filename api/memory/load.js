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
    const { user_id, therapist_code } = body
    if (!user_id) return res.status(400).json({ error: 'user_id required' })

    const supabase = getServiceSupabase()
    const code = therapist_code || process.env.THERAPIST_DEFAULT_CODE

    const [profile, facts, summaries, tags] = await Promise.all([
      supabase.from('mem_profiles').select('*').eq('user_id', user_id).eq('therapist_code', code).maybeSingle(),
      supabase.from('mem_facts').select('*').eq('user_id', user_id).eq('therapist_code', code).order('created_at', { ascending: false }).limit(100),
      supabase.from('mem_summaries').select('*').eq('user_id', user_id).eq('therapist_code', code).order('created_at', { ascending: false }).limit(50),
      supabase.from('mem_tags').select('*').eq('user_id', user_id).eq('therapist_code', code).order('created_at', { ascending: false }).limit(100),
    ]).then(all => all.map(r => r.data))

    return res.status(200).json({
      ok: true,
      data: {
        profile: profile?.data || {},
        facts: facts || [],
        summaries: summaries || [],
        tags: (tags || []).map(t => t.tag),
      },
    })
  } catch (e) {
    return res.status(500).json({ error: 'exception' })
  }
}
