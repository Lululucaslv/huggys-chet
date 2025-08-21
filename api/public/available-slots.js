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
    const userIds = Array.from(
      new Set(
        list.map((s) => s?.user_profiles?.user_id).filter(Boolean)
      )
    )

    let therapistByUserId = new Map()
    if (userIds.length > 0) {
      const { data: th } = await supabase
        .from('therapists')
        .select('user_id, name, verified')
        .in('user_id', userIds)
      therapistByUserId = new Map(
        (th || [])
          .filter((r) => r && r.verified)
          .map((r) => [String(r.user_id), r])
      )
    }

    const hydrated = list.map((slot) => {
      const uid = slot?.user_profiles?.user_id ? String(slot.user_profiles.user_id) : null
      const tRow = uid ? therapistByUserId.get(uid) : null
      const name = tRow?.name || ''
      return {
        id: slot.id,
        therapist_id: slot.therapist_id,
        start_time: slot.start_time,
        end_time: slot.end_time,
        is_booked: slot.is_booked,
        therapist_name: name
      }
    })

    res.status(200).json({ success: true, data: hydrated })
  } catch (e) {
    res.status(500).json({ error: e.message || 'Unexpected error' })
  }
}
