import { getServiceSupabase } from '../_utils/supabaseServer.js'

export const runtime = 'nodejs'

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const supabase = getServiceSupabase()

    const { data: slots, error } = await supabase
      .from('availability')
      .select(`
        id,
        therapist_id,
        start_time,
        end_time,
        is_booked,
        user_profiles!availability_therapist_id_fkey (
          user_id
        )
      `)
      .eq('is_booked', false)
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })

    if (error) {
      res.status(400).json({ error: error.message })
      return
    }

    const list = Array.isArray(slots) ? slots : []
    const valid = list.filter((s) => Boolean(s?.user_profiles?.user_id))
    const userIds = Array.from(
      new Set(
        valid.map((s) => s.user_profiles.user_id).filter(Boolean)
      )
    )

    let therapistByUserId = new Map()
    let displayNameByUserId = new Map()
    let emailPrefixByUserId = new Map()

    if (userIds.length > 0) {
      const [{ data: th }, { data: ups }] = await Promise.all([
        supabase
          .from('therapists')
          .select('user_id, name, verified')
          .in('user_id', userIds),
        supabase
          .from('user_profiles')
          .select('user_id, display_name')
          .in('user_id', userIds)
      ])

      therapistByUserId = new Map(
        (th || [])
          .filter((r) => r && r.verified)
          .map((r) => [String(r.user_id), r])
      )

      displayNameByUserId = new Map(
        (ups || [])
          .filter((r) => r && r.user_id)
          .map((r) => [String(r.user_id), r.display_name || ''])
      )

      const adminUsers = await Promise.all(
        userIds.map(async (uid) => {
          try {
            const { data: u } = await supabase.auth.admin.getUserById(uid)
            const email = u?.user?.email || ''
            const prefix = email.includes('@') ? email.split('@')[0] : ''
            return [String(uid), prefix]
          } catch {
            return [String(uid), '']
          }
        })
      )
      emailPrefixByUserId = new Map(adminUsers)
    }

    const isGeneric = (s) => {
      if (!s) return false
      const n = String(s).trim().toLowerCase()
      return n === 'therapist' || n === '治疗师'
    }

    const hydrated = valid.map((slot) => {
      const uid = String(slot.user_profiles.user_id)
      const tRow = therapistByUserId.get(uid)
      const upName = displayNameByUserId.get(uid) || ''
      const emailFallback = emailPrefixByUserId.get(uid) || ''
      const primary = tRow?.name
      const name = (primary && !isGeneric(primary) ? primary : '') || upName || emailFallback || ''
      return {
        id: slot.id,
        therapist_id: slot.therapist_id,
        start_time: slot.start_time,
        end_time: slot.end_time,
        is_booked: slot.is_booked,
        therapist_name: name
      }
    })

    res.status(200).json({ success: true, data: hydrated, meta: { filtered: true, genericGuard: true } })
  } catch (e) {
    res.status(500).json({ error: e.message || 'Unexpected error' })
  }
}
