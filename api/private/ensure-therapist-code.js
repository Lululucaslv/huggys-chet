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
      const genLocalCode = async () => {
        try {
          const { data: gen } = await supabase.rpc('gen_therapist_code', { len: 8 })
          if (typeof gen === 'string' && gen.trim()) return gen.trim()
        } catch {}
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        return Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
      }

      let attempts = 0
      let persisted = false
      let lastCode = null

      while (attempts < 5 && !persisted) {
        attempts++
        const newCode = await genLocalCode()
        lastCode = newCode

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
          if (!insErr && ins?.code) {
            code = ins.code
            persisted = true
            break
          }
        } else {
          const { data: upd, error: updErr } = await supabase
            .from('therapists')
            .update({ code: newCode })
            .eq('user_id', userId)
            .select('code')
            .maybeSingle()
          if (!updErr && (upd?.code || newCode)) {
            code = upd?.code || newCode
            persisted = true
            break
          }
        }
      }

      if (!persisted) {
        res.status(200).json({ code: lastCode, persisted: false })
        return
      }
    }

    res.status(200).json({ code, persisted: true })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
}
