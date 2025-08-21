import { getServiceSupabase } from '../_utils/supabaseServer.js'

export default async function handler(req, res) {
  try {
    const code = String(req.query?.code || '').trim()
    if (!code) {
      res.status(400).json({ error: 'missing code' })
      return
    }
    const supabase = getServiceSupabase()
    const result = { input: code, therapist: null, profileId: null, availability: null, errors: {} }

    const { data: tExact, error: tErr } = await supabase
      .from('therapists')
      .select('id, user_id, name, verified, code')
      .eq('code', code)
      .limit(1)
    if (tErr) {
      result.errors.therapist = tErr.message || String(tErr)
      res.status(200).json(result)
      return
    }
    const therapist = Array.isArray(tExact) && tExact.length > 0 ? tExact[0] : null
    result.therapist = therapist
    if (!therapist) {
      res.status(200).json(result)
      return
    }

    const { data: prof, error: pErr } = await supabase
      .from('user_profiles')
      .select('id, user_id, display_name')
      .eq('user_id', String(therapist.user_id))
      .maybeSingle()
    if (pErr) result.errors.profile = pErr.message || String(pErr)
    result.profileId = prof?.id || null

    if (result.profileId) {
      const { data: av, error: aErr } = await supabase
        .from('availability')
        .select('id, therapist_id, start_time, end_time, is_booked')
        .eq('therapist_id', result.profileId)
        .order('start_time', { ascending: true })
      if (aErr) result.errors.availability = aErr.message || String(aErr)
      result.availability = av || []
    }

    res.status(200).json(result)
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
}
