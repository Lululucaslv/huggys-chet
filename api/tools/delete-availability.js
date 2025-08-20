import { z } from 'zod'
import { getServiceSupabase, getAuthUserIdFromRequest, requireTherapistProfileId } from '../_utils/supabaseServer.js'

export const runtime = 'nodejs'

const schema = z.object({
  availabilityId: z.union([z.number(), z.string()])
})

export default async function handler(req, res) {
  try {
    if (req.method !== 'DELETE') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const supabase = getServiceSupabase()
    const userId = await getAuthUserIdFromRequest(req, supabase)
    const therapistProfileId = await requireTherapistProfileId(supabase, userId)

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const { availabilityId } = schema.parse(body)

    const { data, error } = await supabase
      .from('availability')
      .delete()
      .eq('id', availabilityId)
      .eq('therapist_id', therapistProfileId)
      .select('id')
      .maybeSingle()

    if (error) {
      res.status(400).json({ error: error.message })
      return
    }

    res.status(200).json({ success: true, data })
  } catch (e) {
    console.error('[tools/delete-availability] error', e)
    const code = e.code || 500
    res.status(code).json({ success: false, error: e.message || 'Unexpected error', details: e.stack || null })
  }
}
