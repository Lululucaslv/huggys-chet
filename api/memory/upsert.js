import { getServiceSupabase } from '../_utils/supabaseServer.js'

export const runtime = 'nodejs'

function withCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Memory-Write-Key')
}

function readRawAuth(req) {
  return (
    req.headers['authorization'] ||
    req.headers['Authorization'] ||
    req.headers['x-memory-write-key'] ||
    req.headers['X-Memory-Write-Key'] ||
    ''
  )
}

function toNFKC(s) {
  try { return typeof s === 'string' && s.normalize ? s.normalize('NFKC') : s } catch { return s }
}
function stripZeroWidth(s) {
  return String(s || '').replace(/[\u200B-\u200D\uFEFF\u2060\u180E]/g, '')
}
function collapseSpaces(s) {
  return String(s || '').replace(/[ \t\r\n]+/g, ' ')
}
function onlySafeChars(s) {
  if (typeof s !== 'string') s = String(s || '')
  s = s.replace(/^Bearer\s+/i, '')
  s = s.replace(/[^A-Za-z0-9_]/g, '')
  return s
}
function constantTimeEq(a, b) {
function firstDiff(a, b) {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      return { i, a: a[i], b: b[i], aCode: a.charCodeAt(i), bCode: b.charCodeAt(i) }
    }
  }
  return { i: n, a: null, b: null, aCode: null, bCode: null }
}

  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= (a.charCodeAt(i) ^ b.charCodeAt(i))
  return r === 0
}
function firstDiffIndex(a, b) {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i
  return a.length === b.length ? -1 : n
}
function codePointAtSafe(s, i) {
  try {
    if (typeof s !== 'string') s = String(s || '')
    if (i < 0 || i >= s.length) return null
    return s.codePointAt(i)
  } catch {
    return null
  }
}


export default async function handler(req, res) {
  withCors(res)
  try {
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS')
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const expectedRaw = process.env.MEMORY_WRITE_KEY ?? ''
    const authRaw = readRawAuth(req) ?? ''
    const expected = onlySafeChars(expectedRaw)
    const token = onlySafeChars(authRaw)

    const same = constantTimeEq(expected, token)
    const diffIdx = same ? -1 : firstDiffIndex(expected, token)
    const hdrsSeen = {
      authorization: !!(req.headers['authorization'] || req.headers['Authorization']),
      xMemoryWriteKey: !!(req.headers['x-memory-write-key'] || req.headers['X-Memory-Write-Key']),
      xApiKey: !!(req.headers['x-api-key'] || req.headers['X-API-KEY'])
    }
    const envCp = diffIdx >= 0 ? codePointAtSafe(expected, diffIdx) : null
    const tokCp = diffIdx >= 0 ? codePointAtSafe(token, diffIdx) : null
    const diag = {
      hasAuth: !!authRaw,
      hdrsSeen,
      envPrefix: expected.slice(0, 8),
      envSuffix: expected.slice(-4),
      tokPrefix: token.slice(0, 8),
      tokSuffix: token.slice(-4),
      lenEnv: expected.length,
      lenTok: token.length,
      same,
      diffIdx,
      envCp,
      tokCp
    }

    if (!same) {
      try {
        const supabase = getServiceSupabase()
        const diff = firstDiff(expected, token)
        await supabase.from('ai_logs').insert([
          {
            scope: 'memory_upsert',
            ok: false,
            model: 'auth',
            payload: JSON.stringify(diag).slice(0, 4000),
            error: 'unauthorized'
          },
          {
            scope: 'memory_upsert',
            ok: false,
            model: 'auth-diff',
            payload: JSON.stringify({ ...diag, diff }).slice(0, 4000),
            error: 'unauthorized'
          }
        ])
      } catch {}
      return res.status(401).json({ error: 'unauthorized' })
    }

    try {
      const supabase = getServiceSupabase()
      await supabase.from('ai_logs').insert({
        scope: 'memory_upsert',
        ok: true,
        model: 'auth',
        payload: JSON.stringify(diag).slice(0, 4000)
      })
    } catch {}

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
