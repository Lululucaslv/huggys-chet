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

    const bodyRaw = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const body = bodyRaw && typeof bodyRaw === 'object' ? bodyRaw : {}
    const inputs = body && typeof body.inputs === 'object' ? body.inputs : null

    const user_id =
      (inputs && (inputs.client_user_id)) ||
      body.client_user_id ||
      body.user_id ||
      body.userId ||
      body.user ||
      (inputs && (inputs.user_id || inputs.userId || inputs.user))

    const therapist_code =
      body.therapist_code ||
      body.therapistCode ||
      (inputs && (inputs.therapist_code || inputs.therapistCode)) ||
      process.env.THERAPIST_DEFAULT_CODE

    const supabase = getServiceSupabase()

    if (!user_id) {
      try {
        await supabase.from('ai_logs').insert({
          scope: 'memory_load',
          ok: false,
          model: 'n/a',
          payload: JSON.stringify({ receivedKeys: Object.keys(body || {}), hasInputs: !!inputs }).slice(0, 4000),
          error: 'user_id required'
        })
      } catch {}
      return res.status(400).json({
        error: 'user_id required',
        receivedKeys: Object.keys(body || {}),
        hasInputs: !!inputs
      })
    }

    const code = therapist_code

    const [profile, facts, summaries, tags] = await Promise.all([
      supabase.from('mem_profiles').select('*').eq('user_id', user_id).eq('therapist_code', code).maybeSingle(),
      supabase.from('mem_facts').select('*').eq('user_id', user_id).eq('therapist_code', code).order('created_at', { ascending: false }).limit(100),
      supabase.from('mem_summaries').select('*').eq('user_id', user_id).eq('therapist_code', code).order('created_at', { ascending: false }).limit(50),
      supabase.from('mem_tags').select('*').eq('user_id', user_id).eq('therapist_code', code).order('created_at', { ascending: false }).limit(100),
    ]).then(all => all.map(r => r.data))

    try {
      await supabase.from('ai_logs').insert({
        scope: 'memory_load',
        ok: true,
        model: 'n/a',
        payload: JSON.stringify({ user_id, therapist_code: code }).slice(0, 4000),
        output: JSON.stringify({
          counts: {
            facts: Array.isArray(facts) ? facts.length : 0,
            summaries: Array.isArray(summaries) ? summaries.length : 0,
            tags: Array.isArray(tags) ? tags.length : 0
          }
        }).slice(0, 4000)
      })
    } catch {}

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
    try {
      const supabase = getServiceSupabase()
      await supabase.from('ai_logs').insert({
        scope: 'memory_load',
        ok: false,
        model: 'n/a',
        error: String(e && e.message ? e.message : e)
      })
    } catch {}
    return res.status(500).json({ error: 'exception' })
  }
}
