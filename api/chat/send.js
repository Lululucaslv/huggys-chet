import { getServiceSupabase } from '../_utils/supabaseServer.js'

export const runtime = 'nodejs'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const { bookingId, role, content, userId } = body
    if (!userId || !role || !content) {
      res.status(400).json({ error: 'userId, role, content required' })
      return
    }
    const supabase = getServiceSupabase()
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        booking_id: bookingId || null,
        user_id: userId,
        role,
        message: String(content),
      })
      .select()
      .single()
    if (error) throw error
    res.status(200).json({ chat: data })
  } catch (e) {
    res.status(500).json({ error: e.message || 'send chat failed' })
  }
}
