import { z } from 'zod'
import { getServiceSupabase, getAuthUserIdFromRequest, requireTherapistProfileId } from '../_utils/supabaseServer.js'

export const runtime = 'nodejs'

const querySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional()
})

export default async function handler(req, res) {
  try {
    console.log('[tools/get-availability] start')
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const supabase = getServiceSupabase()
    const userId = await getAuthUserIdFromRequest(req, supabase)
    const therapistProfileId = await requireTherapistProfileId(supabase, userId)

    const parsed = querySchema.safeParse(req.query || {})
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query parameters', details: parsed.error?.errors || null })
      return
    }
    const { startDate, endDate } = parsed.data

    let q = supabase
      .from('availability')
      .select('*')
      .eq('therapist_id', therapistProfileId)
      .eq('is_booked', false)
      .order('start_time', { ascending: true })

    if (startDate) q = q.gte('start_time', `${startDate}T00:00:00Z`)
    if (endDate) q = q.lte('start_time', `${endDate}T23:59:59Z`)

    const { data, error } = await q
    if (error) {
      res.status(400).json({ error: error.message })
      return
    }

    res.status(200).json({ success: true, data: data || [] })
  } catch (e) {
    console.error('[tools/get-availability] error', e)
    const code = e.code || 500
    res.status(code).json({ success: false, error: e.message || 'Unexpected error', details: e.stack || null })
  }
}
