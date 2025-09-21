import OpenAI from 'openai'
import { z } from 'zod'
import { getServiceSupabase, getAuthUserIdFromRequest, requireTherapistProfileId } from '../_utils/supabaseServer.js'

export const runtime = 'nodejs'

const schema = z.object({
  clientEmail: z.string().email().optional(),
  clientName: z.string().optional()
}).refine((v) => !!(v.clientEmail || v.clientName), { message: 'clientEmail or clientName required' })

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({ error: 'Missing OPENAI_API_KEY' })
      return
    }

    const supabase = getServiceSupabase()
    const userId = await getAuthUserIdFromRequest(req, supabase)
    await requireTherapistProfileId(supabase, userId)

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const { clientEmail, clientName } = schema.parse(body)

    const { data: therapist, error: tErr } = await supabase
      .from('therapists')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()
    if (tErr || !therapist) {
      res.status(400).json({ error: 'Therapist record not found' })
      return
    }

    let clientUserId = null

    const { data: recent, error: rErr } = await supabase
      .from('bookings')
      .select('client_user_id')
      .eq('therapist_id', therapist.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (!rErr && Array.isArray(recent)) {
      for (const b of recent) {
        try {
          const { data: u } = await supabase.auth.admin.getUserById(b.client_user_id)
          const email = u?.user?.email || ''
          const local = email.split('@')[0] || ''
          if ((clientEmail && email.toLowerCase() === clientEmail.toLowerCase()) ||
              (clientName && local.toLowerCase().includes(clientName.toLowerCase()))) {
            clientUserId = b.client_user_id
            break
          }
        } catch {}
      }
    }

    if (!clientUserId) {
      res.status(404).json({ error: 'Client not found from recent bookings' })
      return
    }

    const { data: msgs, error: mErr } = await supabase
      .from('chat_messages')
      .select('role, message, created_at')
      .eq('user_id', clientUserId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (mErr) {
      res.status(400).json({ error: mErr.message })
      return
    }

    const transcript = (msgs || []).reverse().map(m => `${m.role}: ${m.message}`).join('\n')

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      prompt: process.env.OPENAI_SYSTEM_PROMPT_THERAPIST_ID,
      messages: [
        { role: 'user', content: `Create a brief pre-session summary for the therapist based on this transcript.\nInclude: key themes, risks, goals, coping strategies, suggested agenda.\nTranscript:\n${transcript}` }
      ],
      temperature: 0.3,
      max_tokens: 600
    })

    const content = completion.choices[0]?.message?.content || 'No summary available.'
    res.status(200).json({ success: true, data: { clientUserId, summary: content } })
  } catch (e) {
    const message = e && e.message ? String(e.message) : '请求失败，请稍后重试'
    res.status(200).json({
      success: true,
      content: `工具返回错误：${message}`,
      toolCalls: [],
      toolResults: [],
      fallback: true
    })
  }
}
