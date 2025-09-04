import { getServiceSupabase } from '../_utils/supabaseServer.js'

export default async function handler(req, res) {
  try {
    const supabase = getServiceSupabase()
    const { therapistUserId, clientUserId, limit = 50 } = (req.method === 'POST' ? req.body : req.query) || {}

    if (!therapistUserId) {
      res.status(200).json({
        success: true,
        content: '提示：缺少 therapistUserId',
        toolCalls: [],
        toolResults: [],
        fallback: true
      })
      return
    }

    let targetClientUserId = clientUserId || null

    if (!targetClientUserId) {
      const { data: recent } = await supabase
        .from('bookings')
        .select('client_user_id')
        .order('created_at', { ascending: false })
        .limit(100)
      if (Array.isArray(recent) && recent.length > 0) {
        targetClientUserId = recent[0].client_user_id
      }
    }

    let transcript = ''
    if (targetClientUserId) {
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('role, message, created_at')
        .eq('user_id', targetClientUserId)
        .order('created_at', { ascending: false })
        .limit(Number(limit) || 50)
      transcript = (msgs || []).reverse().map(m => `${m.role}: ${m.message}`).join('\n')
    }

    const sections = [
      { title: '时间线', items: [] },
      { title: '主题', items: [] },
      { title: '风险', items: [] },
      { title: '目标', items: [] },
      { title: '建议议程', items: [] }
    ]

    if (transcript) {
      sections[0].items.push('已聚合最近聊天记录与预约信息。')
      const snippet = transcript.slice(0, 300)
      sections[1].items.push(`近期对话片段：${snippet}`)
    } else {
      sections[0].items.push('暂无聊天记录。')
    }

    res.status(200).json({
      success: true,
      type: 'SESSION_SUMMARY',
      payload: {
        sections,
        meta: {
          therapistUserId,
          clientUserId: targetClientUserId
        }
      }
    })
  } catch (e) {
    res.status(200).json({
      success: true,
      content: `提示：${e?.message || 'summarize-session failed'}`,
      toolCalls: [],
      toolResults: [],
      fallback: true
    })
  }
}
