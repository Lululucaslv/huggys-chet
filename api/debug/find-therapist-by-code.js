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
      profile: null,
      availability: null,
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

    const resolved = Array.isArray(exact?.data) && exact.data.length ? exact.data[0]
      : (Array.isArray(ilike?.data) && ilike.data.length ? ilike.data[0]
      : (Array.isArray(contains?.data) && contains.data.length ? contains.data[0] : null))

    if (resolved?.user_id) {
      const { data: prof, error: pErr } = await supabase
        .from('user_profiles')
        .select('id, user_id')
        .eq('user_id', String(resolved.user_id))
        .maybeSingle()
      if (pErr) result.errors.profile = pErr.message || String(pErr)
      result.profile = prof || null

      if (prof?.id) {
        const { data: av, error: aErr } = await supabase
          .from('availability')
          .select('id, therapist_id, start_time, end_time, is_booked')
          .eq('therapist_id', prof.id)
          .order('start_time', { ascending: true })
        if (aErr) result.errors.availability = aErr.message || String(aErr)
        result.availability = av || []
      }
    }

    res.status(200).json(result)
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
}
