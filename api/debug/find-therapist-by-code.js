import { getServiceSupabase } from '../_utils/supabaseServer.js'

export default async function handler(req, res) {
  try {
    const code = String(req.query?.code || '').trim()
    if (!code) {
      res.status(400).json({ error: 'missing code' })
      return
    }
    const supabase = getServiceSupabase()

    const result = {
      host: null,
      input: code,
      exact: null,
      ilike: null,
      contains: null,
      errors: {}
    }
    try { result.host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').host } catch {}

    const exact = await supabase
      .from('therapists')
      .select('id, user_id, name, verified, code', { count: 'exact' })
      .eq('code', code)
      .limit(5)
    result.exact = { count: exact.count ?? null, rows: exact.data || null }
    if (exact.error) result.errors.exact = exact.error.message || String(exact.error)

    const ilike = await supabase
      .from('therapists')
      .select('id, user_id, name, verified, code', { count: 'exact' })
      .ilike('code', code)
      .limit(5)
    result.ilike = { count: ilike.count ?? null, rows: ilike.data || null }
    if (ilike.error) result.errors.ilike = ilike.error.message || String(ilike.error)

    const contains = await supabase
      .from('therapists')
      .select('id, user_id, name, verified, code', { count: 'exact' })
      .ilike('code', `%${code}%`)
      .limit(5)
    result.contains = { count: contains.count ?? null, rows: contains.data || null }
    if (contains.error) result.errors.contains = contains.error.message || String(contains.error)

    res.status(200).json(result)
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
}
