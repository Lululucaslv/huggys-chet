import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env')
  return createClient(url, key, { auth: { persistSession: false } })
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
    const supabase = getServiceSupabase()
    const code = process.env.THERAPIST_DEFAULT_CODE || '8W79AL2B'
    const start = new Date(Date.now() + 24 * 3600 * 1000) // +24h
    start.setMinutes(0, 0, 0)
    const end = new Date(start.getTime() + 60 * 60 * 1000) // +60m

    await supabase
      .from('therapists')
      .upsert({ code, name: 'Default Therapist', active: true })
      .eq('code', code)

    const { data: existing } = await supabase
      .from('therapist_availability')
      .select('id')
      .eq('therapist_code', code)
      .eq('status', 'open')
      .gt('start_utc', new Date().toISOString())
      .lt('start_utc', new Date(Date.now() + 72 * 3600 * 1000).toISOString())
      .limit(1)

    if (!existing?.length) {
      const { data, error } = await supabase
        .from('therapist_availability')
        .insert({
          therapist_code: code,
          start_utc: start.toISOString(),
          end_utc: end.toISOString(),
          status: 'open'
        })
        .select()
        .single()
      if (error) throw error
      return res.status(200).json({ created: true, slot: data })
    } else {
      return res.status(200).json({ created: false })
    }
  } catch (e) {
    return res.status(500).json({ error: e.message || 'failed to add availability' })
  }
}
