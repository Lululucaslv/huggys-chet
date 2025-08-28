import { getServiceSupabase } from '../_utils/supabaseServer.js'
import { respondWithPromptId, fallbackChatCompletion } from '../_utils/openai.js'

export const runtime = 'nodejs'

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    const bookingId = String(req.query.bookingId || '')
    if (!bookingId) {
      res.status(400).json({ error: 'bookingId required' })
      return
    }
    const supabase = getServiceSupabase()
    const { data: booking, error: e1 } = await supabase
      .from('bookings')
      .select('id,therapist_code,start_utc,duration_mins,user_id')
      .eq('id', bookingId)
      .single()
    if (e1 || !booking) {
      res.status(404).json({ error: 'booking not found' })
      return
    }

    const { data: chatHistory, error: e2 } = await supabase
      .from('chat_messages')
      .select('id,role,message,created_at')
      .eq('user_id', booking.user_id)
      .eq('booking_id', booking.id)
      .order('created_at', { ascending: false })
      .limit(20)
    if (e2) throw e2

    const payload = {
      booking,
      userId: booking.user_id,
      chatHistory,
    }

    try {
      const text = await respondWithPromptId('gpt-5', 'OPENAI_SYSTEM_PROMPT_THERAPIST_ID', payload)
      res.status(200).json({ text })
    } catch (err) {
      const text = await fallbackChatCompletion('gpt-5', 'OPENAI_SYSTEM_PROMPT_THERAPIST', JSON.stringify(payload))
      res.status(200).json({ text, fallback: true })
    }
  } catch (e) {
    res.status(500).json({ error: e.message || 'summary failed' })
  }
}
