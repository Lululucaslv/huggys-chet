import { getServiceSupabase } from '../_utils/supabaseServer.js'

export default async function handler(req, res) {
  try {
    const { userId } = req.query || {}
    if (!userId) {
      res.status(400).json({ error: 'missing userId' })
      return
    }
    const supabase = getServiceSupabase()

    const { data: row, error: selErr } = await supabase
      .from('therapists')
      .select('id, code')
      .eq('user_id', userId)
      .maybeSingle()

    if (selErr) {
      res.status(500).json({ error: 'select_failed' })
      return
    }

    let code = row?.code || null
    if (!code) {
      let newCode = null
      try {
        const { data: gen } = await supabase.rpc('gen_therapist_code', { len: 8 })
        if (typeof gen === 'string' && gen.trim()) newCode = gen.trim()
      } catch {}

      if (!newCode) {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        newCode = Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
      }

      if (!row) {
        let fallbackName = 'Therapist'
        try {
          const { data: up } = await supabase
            .from('user_profiles')
            .select('display_name, user_id')
            .eq('user_id', userId)
            .maybeSingle()
          const emailPrefix = (up?.user_id || '').split('@')[0]
          fallbackName = (up?.display_name && String(up.display_name).trim()) || (emailPrefix || fallbackName)
        } catch {}
        const { data: ins, error: insErr } = await supabase
          .from('therapists')
          .insert({ user_id: userId, name: fallbackName, verified: true, code: newCode })
          .select('code')
          .maybeSingle()
        if (insErr) {
          res.status(200).json({ code: newCode, persisted: false })
          return
        }
        code = ins?.code || newCode
      } else {
        const { data: upd, error: updErr } = await supabase
          .from('therapists')
          .update({ code: newCode })
          .eq('user_id', userId)
          .select('code')
          .maybeSingle()
        if (updErr) {
          res.status(200).json({ code: newCode, persisted: false })
          return
        }
        code = upd?.code || newCode
      }
    }

    res.status(200).json({ code, persisted: true })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
}
