import { z } from 'zod'
import { getServiceSupabase, getAuthUserIdFromRequest, requireTherapistProfileId } from '../_utils/supabaseServer.js'

export const runtime = 'nodejs'

const schema = z.object({
  startTime: z.string(),
  endTime: z.string(),
  isRecurring: z.boolean().optional()
})

export default async function handler(req, res) {
  try {
    console.log('[tools/set-availability] start')
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    const supabase = getServiceSupabase()
    const userId = await getAuthUserIdFromRequest(req, supabase)
    const therapistProfileId = await requireTherapistProfileId(supabase, userId)

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload', details: parsed.error?.errors || null })
      return
    }
    const { startTime, endTime } = parsed.data

    if (new Date(startTime) >= new Date(endTime)) {
      res.status(400).json({ error: 'endTime must be after startTime' })
      return
    }

    const { data, error } = await supabase
      .from('availability')
      .insert([{ therapist_id: therapistProfileId, start_time: startTime, end_time: endTime, is_booked: false }])
      .select('id, therapist_id, start_time, end_time, is_booked')
      .single()

    if (error) {
      res.status(400).json({ error: error.message })
      return
    }

    res.status(200).json({ success: true, data })
  } catch (e) {
    console.error('[tools/set-availability] error', e)
    const code = e.code || 500
    res.status(code).json({ success: false, error: e.message || 'Unexpected error', details: e.stack || null })
  }
}
