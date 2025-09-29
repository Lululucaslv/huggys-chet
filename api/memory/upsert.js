import { getServiceSupabase } from '../_utils/supabaseServer.js'

export const runtime = 'nodejs'

function withCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function bearer(req) {
  const h = req.headers['authorization'] || req.headers['Authorization']
  if (typeof h === 'string' && h.startsWith('Bearer ')) return h.slice(7).trim()
  return null
}

export default async function handler(req, res) {
  withCors(res)
  try {
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS')
      return res.status(405).json({ error: 'Method not allowed' })
    }

    if (bearer(req) !== process.env.MEMORY_WRITE_KEY) {
      try {
        const supabase = getServiceSupabase()
        await supabase.from('ai_logs').insert({
          scope: 'memory_upsert',
          ok: false,
          model: 'n/a',
          payload: JSON.stringify({
            hasAuth: !!(req.headers['authorization'] || req.headers['Authorization']),
            authPrefix: String(req.headers['authorization'] || req.headers['Authorization'] || '').slice(0, 12),
            envPrefix: String(process.env.MEMORY_WRITE_KEY || '').slice(0, 6)
          }).slice(0, 4000),
          error: 'unauthorized'
        })
      } catch {}
      return res.status(401).json({ error: 'unauthorized' })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const {
      user_id,
      therapist_code,
      profile_patch,
      facts_add,
      facts_remove,
      summary_add,
      summary_remove,
      tags_add,
      tags_remove,
    } = body
    if (!user_id) return res.status(400).json({ error: 'user_id required' })

    const supabase = getServiceSupabase()
    const code = therapist_code || process.env.THERAPIST_DEFAULT_CODE

    if (profile_patch) {
      const { data: cur } = await supabase.from('mem_profiles').select('*').eq('user_id', user_id).eq('therapist_code', code).maybeSingle()
      const merged = { ...(cur?.data || {}), ...profile_patch }
      await supabase.from('mem_profiles').upsert({ user_id, therapist_code: code, data: merged }, { onConflict: 'user_id,therapist_code' })
    }
    if (Array.isArray(facts_add) && facts_add.length) {
      await supabase.from('mem_facts').insert(facts_add.map(f => ({ user_id, therapist_code: code, text: f.text, source: f.from || 'llm' })))
    }
    if (Array.isArray(facts_remove) && facts_remove.length) {
      await supabase.from('mem_facts').delete().in('id', facts_remove.map(x => x.id))
    }
    if (Array.isArray(summary_add) && summary_add.length) {
      await supabase.from('mem_summaries').insert(summary_add.map(s => ({ user_id, therapist_code: code, text: s.text, source: s.from || 'llm' })))
    }
    if (Array.isArray(summary_remove) && summary_remove.length) {
      await supabase.from('mem_summaries').delete().in('id', summary_remove.map(x => x.id))
    }
    if (Array.isArray(tags_add) && tags_add.length) {
      await supabase.from('mem_tags').insert(tags_add.map(tag => ({ user_id, therapist_code: code, tag })))
    }
    if (Array.isArray(tags_remove) && tags_remove.length) {
      await supabase.from('mem_tags').delete().eq('user_id', user_id).eq('therapist_code', code).in('tag', tags_remove)
    }

    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: 'exception' })
  }
}
