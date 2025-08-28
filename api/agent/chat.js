import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { getServiceSupabase, getAuthUserIdFromRequest, requireTherapistProfileId } from '../_utils/supabaseServer.js'

export const runtime = 'nodejs'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const { tool, userMessage } = body

    if (!tool || !userMessage) {
      res.status(400).json({ error: 'Missing required parameters' })
      return
    }

    if (tool !== 'chatWithTools') {
      res.status(400).json({ error: 'Invalid tool specified' })
      return
    }

    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({ error: 'Server configuration error: Missing API key' })
      return
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      res.status(500).json({ error: 'Server configuration error: Missing database credentials' })
      return
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 20000
    })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    const serviceSupabase = getServiceSupabase()
    let userId = null
    try {
      userId = await getAuthUserIdFromRequest(req, serviceSupabase)
    } catch (e) {
      userId = body.userId || null
    }
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const { data: profile, error: profErr } = await serviceSupabase
      .from('user_profiles')
      .select('id, life_status')
      .eq('user_id', userId)
      .single()
    if (profErr || !profile) {
      console.log('[agent/chat] profile lookup failed', { userId, profErr })
      res.status(403).json({ error: 'Profile not found' })
      return
    }
    const isTherapist = String(profile.life_status || '').toLowerCase() === 'therapist'
    console.log('[agent/chat] auth resolved', { userId, life_status: profile.life_status, isTherapist })
    try {
      const maybeObj = JSON.parse(userMessage || '{}')
      if (maybeObj && maybeObj.type === 'USER_CONFIRM_TIME') {
        const payload = maybeObj.payload || {}
        const therapistInput = payload.therapist
        const therapistName =
          typeof therapistInput === 'string'
            ? therapistInput
            : (therapistInput?.name || therapistInput?.code || '')
        const date = payload.date || null
        const startTime = payload.startTime || null
        const timezone = payload.timezone || null

        if (!therapistName || !date || !startTime || !timezone) {
          res.status(200).json({ success: false, error: '缺少必要的确认参数' })
          return
        }

        const resolved = await resolveTherapistByNameOrPrefix(supabase, therapistName)
        const matches = resolved.matches || []
        if (matches.length === 0) {
          res.status(200).json({ success: false, error: `未找到咨询师：${therapistName}` })
          return
        }
        const picked = matches[0]
        const profileId = await getUserProfileIdByUserId(supabase, picked.user_id)
        if (!profileId) {
          res.status(200).json({ success: false, error: '未找到该咨询师的档案' })
          return
        }

        const { data: availability, error: avErr } = await supabase
          .from('availability')
          .select('id, start_time, end_time')
          .eq('therapist_id', profileId)
          .eq('is_booked', false)
          .order('start_time', { ascending: true })
        if (avErr) {
          res.status(200).json({ success: false, error: '查询可预约时间时发生错误' })
          return
        }

        const fmtDate = (iso, tz) => {
          const d = new Date(iso)
          const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).format(d)
          return parts
        }
        const fmtTime = (iso, tz) => {
          const d = new Date(iso)
          const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: tz,
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
          }).format(d)
          return parts
        }

        let pickedIso = null
        for (const a of availability || []) {
          const dstr = fmtDate(a.start_time, timezone)
          const tstr = fmtTime(a.start_time, timezone)
          if (dstr === date && tstr.startsWith(startTime)) {
            pickedIso = a.start_time
            break
          }
        }

        if (!pickedIso) {
          res.status(200).json({ success: false, error: '未找到与所选本地时间匹配的可预约时段' })
          return
        }

        const directResult = await createBooking(
          { therapistName, dateTime: pickedIso },
          userId,
          supabase
        )
        if (directResult && directResult.success) {
          res.status(200).json({
            success: true,
            content: directResult.data.message,
            toolCalls: [{ id: 'confirm-createBooking', name: 'createBooking' }],
            toolResults: [{ id: 'confirm-createBooking', name: 'createBooking', result: directResult }]
          })
          return
        }
        res.status(200).json({
          success: false,
          error: (directResult && directResult.error) || '创建预约失败',
          toolCalls: [{ id: 'confirm-createBooking', name: 'createBooking' }],
          toolResults: [{ id: 'confirm-createBooking', name: 'createBooking', result: directResult }]
        })
        return
      }
    } catch {}


    const isoMatch = /ISO:\s*([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.\d+)?(?:Z|[+\-][0-9]{2}:[0-9]{2}))/.exec(userMessage || '')
    const explicitConfirm = /确认预约/.test(userMessage || '')
    if (!isTherapist && isoMatch && explicitConfirm) {
      const iso = isoMatch[1]
      const tMatch = /(Megan\s+Chang)/i.exec(userMessage || '')
      const therapistName = tMatch ? tMatch[1] : 'Megan Chang'
      const directResult = await createBooking({ therapistName, dateTime: iso }, userId, supabase)
      if (directResult && directResult.success) {
        res.status(200).json({
          success: true,
          content: directResult.data.message,
          toolCalls: [{ id: 'direct-createBooking', name: 'createBooking' }],
          toolResults: [{ id: 'direct-createBooking', name: 'createBooking', result: directResult }]
        })
        return
      }
      res.status(200).json({
        success: false,
        error: (directResult && directResult.error) || '创建预约失败',
        toolCalls: [{ id: 'direct-createBooking', name: 'createBooking' }],
        toolResults: [{ id: 'direct-createBooking', name: 'createBooking', result: directResult }]
      })
      return
    }

    const result = await handleChatWithTools(userMessage, userId, openai, supabase, isTherapist, serviceSupabase)
    res.status(200).json(result)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message })
  }
  try {
    const maybeObj = JSON.parse(userMessage || '{}')
    if (maybeObj && maybeObj.type === 'USER_CONFIRM_TIME') {
      const payload = maybeObj.payload || {}
      const therapistInput = payload.therapist
      const therapistName =
        typeof therapistInput === 'string'
          ? therapistInput
          : (therapistInput?.name || therapistInput?.code || '')
      const date = payload.date || null
      const startTime = payload.startTime || null
      const timezone = payload.timezone || null

      if (!therapistName || !date || !startTime || !timezone) {
        res.status(200).json({ success: false, error: '缺少必要的确认参数' })
        return
      }

      const resolved = await resolveTherapistByNameOrPrefix(supabase, therapistName)
      const matches = resolved.matches || []
      if (matches.length === 0) {
        res.status(200).json({ success: false, error: `未找到咨询师：${therapistName}` })
        return
      }
      const picked = matches[0]
      const profileId = await getUserProfileIdByUserId(supabase, picked.user_id)
      if (!profileId) {
        res.status(200).json({ success: false, error: '未找到该咨询师的档案' })
        return
      }

      const { data: availability, error: avErr } = await supabase
        .from('availability')
        .select('id, start_time, end_time')
        .eq('therapist_id', profileId)
        .eq('is_booked', false)
        .order('start_time', { ascending: true })
      if (avErr) {
        res.status(200).json({ success: false, error: '查询可预约时间时发生错误' })
        return
      }

      const fmtDate = (iso, tz) => {
        const d = new Date(iso)
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(d)
        return parts
      }
      const fmtTime = (iso, tz) => {
        const d = new Date(iso)
        const parts = new Intl.DateTimeFormat('en-GB', {
          timeZone: tz,
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        }).format(d)
        return parts
      }

      let pickedIso = null
      for (const a of availability || []) {
        const dstr = fmtDate(a.start_time, timezone)
        const tstr = fmtTime(a.start_time, timezone)
        if (dstr === date && tstr.startsWith(startTime)) {
          pickedIso = a.start_time
          break
        }
      }

      if (!pickedIso) {
        res.status(200).json({ success: false, error: '未找到与所选本地时间匹配的可预约时段' })
        return
      }

      const directResult = await createBooking(
        { therapistName, dateTime: pickedIso },
        userId,
        supabase
      )
      if (directResult && directResult.success) {
        res.status(200).json({
          success: true,
          content: directResult.data.message,
          toolCalls: [{ id: 'confirm-createBooking', name: 'createBooking' }],
          toolResults: [{ id: 'confirm-createBooking', name: 'createBooking', result: directResult }]
        })
        return
      }
      res.status(200).json({
        success: false,
        error: (directResult && directResult.error) || '创建预约失败',
        toolCalls: [{ id: 'confirm-createBooking', name: 'createBooking' }],
        toolResults: [{ id: 'confirm-createBooking', name: 'createBooking', result: directResult }]
      })
      return
    }
  } catch {}

}

async function handleChatWithTools(userMessage, userId, openai, supabase, isTherapist, serviceSupabase) {
  console.log('🔥 v37 - Handling chat with tools (role aware)')
  
  const therapistTools = [
    {
      type: 'function',
      function: {
        name: 'setAvailability',
        description: '为当前治疗师添加可预约时间段，使用ISO时间字符串。',
        parameters: {
          type: 'object',
          properties: {
            startTime: { type: 'string', description: 'ISO 8601 开始时间' },
            endTime: { type: 'string', description: 'ISO 8601 结束时间' },
            isRecurring: { type: 'boolean', description: '可选：是否重复' }
          },
          required: ['startTime', 'endTime']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'getAvailability',
        description: '查询当前治疗师在指定日期范围的可预约时间（未被预定）。',
        parameters: {
          type: 'object',
          properties: {
            startDate: { type: 'string', description: 'YYYY-MM-DD' },
            endDate: { type: 'string', description: 'YYYY-MM-DD' }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'deleteAvailability',
        description: '删除指定的可预约时间记录。',
        parameters: {
          type: 'object',
          properties: {
            availabilityId: { anyOf: [{ type: 'number' }, { type: 'string' }], description: '可预约记录ID' }
          },
          required: ['availabilityId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'getClientSummary',
        description: '根据来访者邮箱或姓名，生成AI会前摘要。',
        parameters: {
          type: 'object',
          properties: {
            clientEmail: { type: 'string' },
            clientName: { type: 'string' }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'summarizeSession',
        description: '为当前咨询师生成结构化会前摘要（时间线/主题/风险/目标/建议议程）。',
        parameters: {
          type: 'object',
          properties: {
            clientEmail: { type: 'string' },
            clientName: { type: 'string' },
            limit: { type: 'number' }
          }
        }
      }
    }
  ]

  const clientTools = [
    {
      type: 'function',
      function: {
        name: 'getTherapistAvailability',
        description: '当用户想要查询、寻找、预订、或询问某位咨询师的空闲时间、可预约时间段或日程安排时，必须使用此工具。',
        parameters: {
          type: 'object',
          properties: {
            therapistName: {
              type: 'string',
              description: '咨询师的姓名，如"Megan Chang"'
            },
            startDate: {
              type: 'string',
              description: '查询开始日期，格式为YYYY-MM-DD，例如2025-08-19。当用户说"明天"时，应理解为2025-08-19。如果用户没有指定年份，默认使用2025年'
            },
            endDate: {
              type: 'string',
              description: '查询结束日期，格式为YYYY-MM-DD。如果用户只提到一个日期，可以省略此参数，系统会自动查询该日期的所有时间段'
            }
          },
          required: ['therapistName']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'createBooking',
        description: '当用户在确认了具体的时间和咨询师后，明确表示希望"确认预约"、"就订这个时间"或"帮我订一下"时，使用此工具来最终锁定并创建预约。',
        parameters: {
          type: 'object',
          properties: {
            therapistName: {
              type: 'string',
              description: '咨询师的姓名，如"Megan Chang"'
            },
            dateTime: {
              type: 'string',
              description: '预约的日期和时间，ISO 8601格式，例如2025-08-19T09:00:00Z'
            },
            duration: {
              type: 'number',
              description: '预约时长（分钟），默认60分钟',
              default: 60
            }
          },
          required: ['therapistName', 'dateTime']
        }
      }
    }
  ]

  const systemPrompt = isTherapist
    ? `You are an AI Executive Assistant for therapists. Be concise, action-oriented, and focus on schedule management and pre-session preparation. Always use the available tools to perform actions:
- setAvailability: add availability for the logged-in therapist using ISO times
- getAvailability: list current unbooked availability slots, with optional date range
- deleteAvailability: remove an availability slot by id
- getClientSummary: produce a pre-session summary for a specific client by email or name

Rules:
- Prefer making changes as requested without unnecessary small talk.
- When asked to “show” or “what’s my schedule”, call getAvailability.
- When asked to “add/block/off” a time, call setAvailability.
- When asked to “remove/cancel a time slot”, call deleteAvailability.
- When asked about a client’s summary, call getClientSummary.
- Respond with short confirmations after actions, including key details and counts.`
    : `你是Huggy AI，一个专业而温暖的AI心理咨询助手。你必须使用提供的工具来帮助用户预约咨询师。

可用工具：
1. getTherapistAvailability - 查询咨询师的可预约时间
2. createBooking - 为用户创建预约

核心规则：你必须优先使用工具来回答你能回答的问题。严禁自行编造任何关于日程、可用时间或预约状态的信息。

重要指令（非常重要）：
- 当用户询问任何关于预约、时间安排、咨询师可用性的问题时，你必须立即调用getTherapistAvailability工具
- 当用户已经确认了具体时间（如消息中包含“确认预约”或包含“ISO:”的时间戳），你必须直接调用createBooking，不要再次调用getTherapistAvailability进行确认
- 如果用户消息中包含“ISO:”后面的时间戳，请将其作为createBooking的dateTime参数使用
- 当前年份是2025年，所有日期都使用2025年格式
- 绝对不要说"我无法查看预约系统"或类似的话，你必须使用工具
- 你必须使用工具，不能自己回答预约相关问题

工作流程：
1. 用户询问预约 → 立即调用getTherapistAvailability工具
2. 展示可用时间段给用户（可包含按钮）
3. 用户确认时间（例如点击按钮后产生“确认预约 …（ISO: …）”的消息）→ 直接调用createBooking工具并返回明确的预约成功/失败反馈

你必须主动使用工具，不要拒绝或说无法帮助预约。`

  const conversationMessages = [
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: userMessage
    }
  ]

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: conversationMessages,
      tools: (isTherapist ? therapistTools : clientTools),
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 500
    })

    const responseMessage = completion.choices[0].message

    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolMessages = [...conversationMessages, responseMessage]
      const toolResults = []

      for (const toolCall of responseMessage.tool_calls) {
        try {
          const functionName = toolCall.function.name
          const functionArgs = JSON.parse(toolCall.function.arguments)

          let toolResult
          if (functionName === 'getTherapistAvailability') {
            toolResult = await getTherapistAvailability(functionArgs, supabase)
          } else if (functionName === 'createBooking') {
            toolResult = await createBooking(functionArgs, userId, supabase)
          } else if (functionName === 'setAvailability') {
            try {
              const therapistProfileId = await requireTherapistProfileId(serviceSupabase, userId)
              const { startTime, endTime } = functionArgs || {}
              if (!startTime || !endTime) {
                toolResult = { success: false, error: 'Missing startTime or endTime' }
              } else if (new Date(startTime) >= new Date(endTime)) {
                toolResult = { success: false, error: 'endTime must be after startTime' }
              } else {
                const { data, error } = await serviceSupabase
                  .from('availability')
                  .insert([{ therapist_id: therapistProfileId, start_time: startTime, end_time: endTime, is_booked: false }])
                  .select('id, start_time, end_time')
                  .single()
                if (error) toolResult = { success: false, error: error.message }
                else toolResult = { success: true, data, message: 'Availability added' }
              }
            } catch (e) {
              toolResult = { success: false, error: e.message || 'Unauthorized' }
            }
          } else if (functionName === 'getAvailability') {
            try {
              const therapistProfileId = await requireTherapistProfileId(serviceSupabase, userId)
              const { startDate, endDate } = functionArgs || {}
              let q = serviceSupabase
                .from('availability')
                .select('id, start_time, end_time')
                .eq('therapist_id', therapistProfileId)
                .eq('is_booked', false)
                .order('start_time', { ascending: true })
              if (startDate) q = q.gte('start_time', `${startDate}T00:00:00Z`)
              if (endDate) q = q.lte('start_time', `${endDate}T23:59:59Z`)
              const { data, error } = await q
              if (error) toolResult = { success: false, error: error.message }
              else toolResult = { success: true, data: data || [] }
            } catch (e) {
              toolResult = { success: false, error: e.message || 'Unauthorized' }
            }
          } else if (functionName === 'summarizeSession') {
            try {
              const { clientEmail, clientName, limit } = functionArgs || {}
              const therapistProfileId = await requireTherapistProfileId(serviceSupabase, userId)
              const { data: tUser, error: tUserErr } = await serviceSupabase
                .from('user_profiles')
                .select('user_id')
                .eq('id', therapistProfileId)
                .single()
              if (tUserErr || !tUser?.user_id) throw new Error('Therapist record not found')
              const { data: therapist, error: tErr } = await serviceSupabase
                .from('therapists')
                .select('id')
                .eq('user_id', tUser.user_id)
                .maybeSingle()
              if (tErr || !therapist) throw new Error('Therapist record not found')

              let clientUserId = null
              const { data: recent } = await serviceSupabase
                .from('bookings')
                .select('client_user_id')
                .eq('therapist_id', therapist.id)
                .order('created_at', { ascending: false })
                .limit(100)
              if (Array.isArray(recent)) {
                for (const b of recent) {
                  try {
                    const { data: u } = await serviceSupabase.auth.admin.getUserById(b.client_user_id)
                    const email = u?.user?.email || ''
                    const local = email.split('@')[0] || ''
                    if ((clientEmail && email.toLowerCase() === String(clientEmail).toLowerCase()) ||
                        (clientName && local.toLowerCase().includes(String(clientName).toLowerCase()))) {
                      clientUserId = b.client_user_id
                      break
                    }
                  } catch {}
                }
              }

              let transcript = ''
              if (clientUserId) {
                const { data: msgs } = await serviceSupabase
                  .from('chat_messages')
                  .select('role, message, created_at')
                  .eq('user_id', clientUserId)
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
              toolResult = {
                success: true,
                data: { sections },
                message: 'SESSION_SUMMARY'
              }
            } catch (e) {
              toolResult = { success: false, error: e.message || 'Error summarizing session' }
            }
          } else if (functionName === 'deleteAvailability') {
            try {
              const therapistProfileId = await requireTherapistProfileId(serviceSupabase, userId)
              const { availabilityId } = functionArgs || {}
              if (!availabilityId) {
                toolResult = { success: false, error: 'availabilityId required' }
              } else {
                const { data, error } = await serviceSupabase
                  .from('availability')
                  .delete()
                  .eq('id', availabilityId)
                  .eq('therapist_id', therapistProfileId)
                  .select('id')
                  .maybeSingle()
                if (error) toolResult = { success: false, error: error.message }
                else toolResult = { success: true, data }
              }
            } catch (e) {
              toolResult = { success: false, error: e.message || 'Unauthorized' }
            }
          } else if (functionName === 'getClientSummary') {
            try {
              if (!process.env.OPENAI_API_KEY) {
                toolResult = { success: false, error: 'Missing OPENAI_API_KEY' }
              } else {
                const openai2 = openai
                const { clientEmail, clientName } = functionArgs || {}
                const therapistProfileId = await requireTherapistProfileId(serviceSupabase, userId)
                const { data: tUser, error: tUserErr } = await serviceSupabase
                  .from('user_profiles')
                  .select('user_id')
                  .eq('id', therapistProfileId)
                  .single()
                if (tUserErr || !tUser?.user_id) throw new Error('Therapist record not found')

                const { data: therapist, error: tErr } = await serviceSupabase
                  .from('therapists')
                  .select('id')
                  .eq('user_id', tUser.user_id)
                  .maybeSingle()
                if (tErr || !therapist) throw new Error('Therapist record not found')

                let clientUserId = null
                const { data: recent } = await serviceSupabase
                  .from('bookings')
                  .select('client_user_id')
                  .eq('therapist_id', therapist.id)
                  .order('created_at', { ascending: false })
                  .limit(100)
                if (Array.isArray(recent)) {
                  for (const b of recent) {
                    try {
                      const { data: u } = await serviceSupabase.auth.admin.getUserById(b.client_user_id)
                      const email = u?.user?.email || ''
                      const local = email.split('@')[0] || ''
                      if ((clientEmail && email.toLowerCase() === String(clientEmail).toLowerCase()) ||
                          (clientName && local.toLowerCase().includes(String(clientName).toLowerCase()))) {
                        clientUserId = b.client_user_id
                        break
                      }
                    } catch {}
                  }
                }
                if (!clientUserId) {
                  toolResult = { success: false, error: 'Client not found from recent bookings' }
                } else {
                  const { data: msgs } = await serviceSupabase
                    .from('chat_messages')
                    .select('role, message, created_at')
                    .eq('user_id', clientUserId)
                    .order('created_at', { ascending: false })
                    .limit(50)
                  const transcript = (msgs || []).reverse().map(m => `${m.role}: ${m.message}`).join('\n')
                  const completion = await openai2.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [
                      { role: 'system', content: 'You are a concise clinical assistant that generates pre-session summaries.' },
                      { role: 'user', content: `Create a brief pre-session summary for the therapist based on this transcript.\nInclude: key themes, risks, goals, coping strategies, suggested agenda.\nTranscript:\n${transcript}` }
                    ],
                    temperature: 0.3,
                    max_tokens: 600
                  })
                  const content = completion.choices[0]?.message?.content || 'No summary available.'
                  toolResult = { success: true, data: { clientUserId, summary: content } }
                }
              }
            } catch (e) {
              toolResult = { success: false, error: e.message || 'Error generating summary' }
            }
          } else {
            toolResult = { success: false, error: `Unknown function: ${functionName}` }
          }

          toolResults.push({ id: toolCall.id, name: functionName, result: toolResult })

          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          })
        } catch (toolError) {
          toolResults.push({ id: toolCall.id, error: toolError.message })
          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ success: false, error: toolError.message })
          })
        }
      }

      const secondCompletion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: toolMessages,
        temperature: 0.3,
        max_tokens: 500
      })
      
      const finalContent = (secondCompletion.choices[0]?.message?.content || '').trim()
      let synthesized = finalContent
      if (!synthesized) {
        try {
          const parts = []
          for (const tr of toolResults) {
            if (tr.name === 'getTherapistAvailability' && tr.result?.success) {
              const data = tr.result.data || {}
              const count = Array.isArray(data.availableSlots) ? data.availableSlots.length : 0
              parts.push(`${data.therapistName || '该咨询师'} 可预约时段共 ${count} 个。${data.message || ''}`)
            } else if (tr.name === 'createBooking' && tr.result?.success) {
              const data = tr.result.data || {}
              parts.push(data.message || `预约已创建：${data.therapistName || ''} - ${data.dateTime || ''}`)
            } else if (tr.name === 'summarizeSession' && tr.result?.success) {
              const secs = (tr.result?.data && tr.result.data.sections) || []
              synthesized = JSON.stringify({ type: 'SESSION_SUMMARY', payload: { sections: secs } })
            } else if (tr.result?.error) {
              parts.push(`工具返回错误：${tr.result.error}`)
            }
          }
          if (!synthesized && parts.length > 0) {
            synthesized = parts.join(' ')
          }
        } catch {}
      }
      return {
        success: true,
        content: synthesized,
        toolCalls: responseMessage.tool_calls.map(tc => ({ id: tc.id, name: tc.function.name })),
        toolResults
      }
    }

    if (!isTherapist) {
      try {
        const upper = String(userMessage || '').toUpperCase()
        const tokenMatch = upper.match(/[A-Z0-9]{4,12}/)
        const codeToken = tokenMatch ? tokenMatch[0] : null
        if (codeToken) {
          const toolResult = await getTherapistAvailability({ therapistName: codeToken }, supabase)
          if (toolResult) {
            return {
              success: true,
              content: toolResult.success
                ? `已为您找到可预约时间，共 ${Array.isArray(toolResult.data?.availableSlots) ? toolResult.data.availableSlots.length : 0} 个。`
                : `工具返回错误：${toolResult.error || '查询失败'}`,
              toolCalls: [{ id: 'fallback', name: 'getTherapistAvailability' }],
              toolResults: [{ id: 'fallback', name: 'getTherapistAvailability', result: toolResult }]
            }
          }
        }
      } catch {}
    }

    const directCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: conversationMessages,
      temperature: 0.3,
      max_tokens: 500
    })
    
    const directContent = directCompletion.choices[0]?.message?.content || ''
    return { success: true, content: directContent }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to process chat',
      details: error.message
    }
  }
}

async function resolveTherapistByNameOrPrefix(supabase, rawName) {
  const inputRaw = String(rawName || '').trim()
  if (!inputRaw) return { matches: [] }

  const upper = inputRaw.toUpperCase()
  let tokenMatches = upper.match(/[A-Z0-9]{6,12}/g) || []
  const cleaned = upper.replace(/[^A-Z0-9]/g, '')
  if (tokenMatches.length === 0 && cleaned.length >= 6 && cleaned.length <= 12) {
    tokenMatches = [cleaned]
  }
  const uniqueTokens = Array.from(new Set(tokenMatches))

  for (const codeToken of uniqueTokens) {
    if (!codeToken) continue
    let codeMatch = null
    try {
      const { data } = await supabase
        .from('therapists')
        .select('user_id, name, verified, code')
        .eq('code', codeToken)
        .limit(2)
      if (Array.isArray(data) && data.length > 0) codeMatch = data[0]
    } catch {}

    if (!codeMatch) {
      try {
        const { data } = await supabase
          .from('therapists')
          .select('user_id, name, verified, code')
          .ilike('code', codeToken)
          .limit(2)
        if (Array.isArray(data) && data.length > 0) codeMatch = data[0]
      } catch {}
    }

    if (!codeMatch) {
      try {
        const { data } = await supabase
          .from('therapists')
          .select('user_id, name, verified, code')
          .ilike('code', `%${codeToken}%`)
          .limit(2)
        if (Array.isArray(data) && data.length > 0) codeMatch = data[0]
      } catch {}
    }

    if (codeMatch) {
      return { matches: [{ user_id: codeMatch.user_id, name: codeMatch.name, verified: codeMatch.verified }] }
    }
  }

  const { data: tMatches } = await supabase
    .from('therapists')
    .select('user_id, name, verified')
    .ilike('name', `%${inputRaw}%`)
    .limit(5)

  if (Array.isArray(tMatches) && tMatches.length > 0) {
    return { matches: tMatches.filter(m => m.verified !== false) }
  }

  const { data: pMatches } = await supabase
    .from('user_profiles')
    .select('user_id, display_name')
    .ilike('display_name', `%${inputRaw}%`)
    .limit(5)

  if (!Array.isArray(pMatches) || pMatches.length === 0) return { matches: [] }
  const userIds = pMatches.map(p => String(p.user_id)).filter(Boolean)
  if (userIds.length === 0) return { matches: [] }

  const { data: thByUsers } = await supabase
    .from('therapists')
    .select('user_id, name, verified')
    .in('user_id', userIds)

  const thMap = new Map((thByUsers || []).map(r => [String(r.user_id), r]))
  const merged = pMatches.map(p => {
    const uid = String(p.user_id)
    const th = thMap.get(uid)
    return {
      user_id: uid,
      name: (th && th.name) || p.display_name || '',
      verified: th ? th.verified !== false : true
    }
  }).filter(m => m.name && (thMap.has(String(m.user_id)) ? (thMap.get(String(m.user_id)).verified !== false) : true))

  return { matches: merged }
}
async function getCodeMatchDebugCounts(supabase, token) {
  const host = (() => {
    try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').host || null } catch { return null }
  })()
  try {
    const exact = await supabase
      .from('therapists')
      .select('id', { count: 'exact', head: true })
      .eq('code', token)
    const ilikeOne = await supabase
      .from('therapists')
      .select('id', { count: 'exact', head: true })
      .ilike('code', token)
    const contains = await supabase
      .from('therapists')
      .select('id', { count: 'exact', head: true })
      .ilike('code', `%${token}%`)
    return {
      exact: typeof exact.count === 'number' ? exact.count : null,
      ilike: typeof ilikeOne.count === 'number' ? ilikeOne.count : null,
      contains: typeof contains.count === 'number' ? contains.count : null,
      host
    }
  } catch (e) {
    return { exact: null, ilike: null, contains: null, host, error: e?.message || 'unknown' }
  }
}


async function getUserProfileIdByUserId(supabase, userId) {
  const { data } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('user_id', String(userId))
    .maybeSingle()
  return data?.id || null
}

async function getTherapistAvailability(params, supabase) {
  try {
    const resolved = await resolveTherapistByNameOrPrefix(supabase, params.therapistName)
    const matches = resolved.matches || []
    if (matches.length === 0) {
      const debugTokens = String(params.therapistName || '')
        .toUpperCase()
        .match(/[A-Z0-9]{6,12}/g) || []
      let counts = ''
      if (debugTokens.length > 0) {
        const c = await getCodeMatchDebugCounts(supabase, debugTokens[0])
        const hostPart = c.host ? ` host:${c.host}` : ''
        const errPart = c.error ? ` err:${c.error}` : ''
        counts = ` [code search counts eq:${c.exact} ilike:${c.ilike} contains:${c.contains}${hostPart}${errPart}]`
      }
      const hint = ` [debug tokens: ${debugTokens.length ? debugTokens.join(',') : 'none'}]${counts}`
      return { success: false, error: `未找到名为 "${params.therapistName}" 的咨询师，请确认姓名或从列表中选择${hint}` }
    }
    if (matches.length > 1) {
      const names = matches.map(m => m.name).join(', ')
      return { success: false, error: `匹配到多位咨询师：${names}。请指明具体姓名` }
    }
    const picked = matches[0]
    const profileId = await getUserProfileIdByUserId(supabase, picked.user_id)
    if (!profileId) return { success: false, error: '未找到该咨询师的档案' }

    let q = supabase
      .from('availability')
      .select('id, start_time, end_time')
      .eq('therapist_id', profileId)
      .eq('is_booked', false)
      .order('start_time', { ascending: true })

    if (params.startDate) q = q.gte('start_time', `${params.startDate}T00:00:00Z`)
    if (params.endDate) q = q.lte('start_time', `${params.endDate}T23:59:59Z`)

    const { data: availability, error } = await q
    if (error) return { success: false, error: '查询可预约时间时发生错误' }

    const slots = (availability || []).map(a => ({
      id: a.id,
      startTime: a.start_time,
      endTime: a.end_time
    }))

    return {
      success: true,
      data: {
        therapistName: picked.name,
        availableSlots: slots,
        message: `找到 ${slots.length} 个可预约时间段。`
      }
    }
  } catch (error) {
    return { success: false, error: '获取咨询师可预约时间时发生错误' }
  }
}

async function createBooking(params, userId, supabase) {
  try {
    const resolved = await resolveTherapistByNameOrPrefix(supabase, params.therapistName)
    const matches = resolved.matches || []
    if (matches.length === 0) {
      const debugTokens = String(params.therapistName || '')
        .toUpperCase()
        .match(/[A-Z0-9]{6,12}/g) || []
      let counts = ''
      if (debugTokens.length > 0) {
        const c = await getCodeMatchDebugCounts(supabase, debugTokens[0])
        const hostPart = c.host ? ` host:${c.host}` : ''
        const errPart = c.error ? ` err:${c.error}` : ''
        counts = ` [code search counts eq:${c.exact} ilike:${c.ilike} contains:${c.contains}${hostPart}${errPart}]`
      }
      const hint = ` [debug tokens: ${debugTokens.length ? debugTokens.join(',') : 'none'}]${counts}`
      return { success: false, error: `未找到名为 "${params.therapistName}" 的咨询师${hint}` }
    }
    if (matches.length > 1) {
      const names = matches.map(m => m.name).join(', ')
      return { success: false, error: `匹配到多位咨询师：${names}。请指明具体姓名` }
    }
    const picked = matches[0]
    const profileId = await getUserProfileIdByUserId(supabase, picked.user_id)
    if (!profileId) return { success: false, error: '未找到该咨询师的档案' }

    const targetDate = new Date(params.dateTime)
    if (isNaN(targetDate.getTime())) return { success: false, error: '无效的时间格式，请提供有效的 ISO 时间' }
    const isoStart = targetDate.toISOString()
    const isoEnd = new Date(targetDate.getTime() + 60 * 1000).toISOString()

    let chosenAvailability = null
    {
      const { data, error } = await supabase
        .from('availability')
        .select('*')
        .eq('therapist_id', profileId)
        .gte('start_time', isoStart)
        .lt('start_time', isoEnd)
        .eq('is_booked', false)
        .single()
      if (!error && data) chosenAvailability = data
    }

    if (!chosenAvailability) {
      const rangeStart = new Date(targetDate.getTime() - 12 * 60 * 60 * 1000).toISOString()
      const rangeEnd = new Date(targetDate.getTime() + 12 * 60 * 60 * 1000).toISOString()
      const { data: nearAvail } = await supabase
        .from('availability')
        .select('*')
        .eq('therapist_id', profileId)
        .gte('start_time', rangeStart)
        .lte('start_time', rangeEnd)
        .eq('is_booked', false)
        .order('start_time', { ascending: true })
      if (Array.isArray(nearAvail) && nearAvail.length > 0) {
        let minDiff = Number.POSITIVE_INFINITY
        for (const a of nearAvail) {
          const diff = Math.abs(new Date(a.start_time).getTime() - targetDate.getTime())
          if (diff < minDiff) { minDiff = diff; chosenAvailability = a }
        }
      }
    }

    if (!chosenAvailability) {
      const dayStart = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0)).toISOString()
      const dayEnd = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 23, 59, 59)).toISOString()
      const { data: dayAvail } = await supabase
        .from('availability')
        .select('*')
        .eq('therapist_id', profileId)
        .gte('start_time', dayStart)
        .lte('start_time', dayEnd)
        .eq('is_booked', false)
        .order('start_time', { ascending: true })
      if (Array.isArray(dayAvail) && dayAvail.length > 0) {
        let minDiff = Number.POSITIVE_INFINITY
        for (const a of dayAvail) {
          const diff = Math.abs(new Date(a.start_time).getTime() - targetDate.getTime())
          if (diff < minDiff) { minDiff = diff; chosenAvailability = a }
        }
        const threeHours = 3 * 60 * 60 * 1000
        if (Math.abs(new Date(chosenAvailability.start_time).getTime() - targetDate.getTime()) > threeHours) {
          chosenAvailability = null
        }
      }
    }

    if (!chosenAvailability) {
      return { success: false, error: '该时间段不可预约或已被预订' }
    }

    const { data: booking, error: bookingError } = await supabase.rpc('create_booking', {
      availability_id_to_book: chosenAvailability.id,
      client_id_to_book: userId
    })

    if (bookingError || !booking) {
      const { data: updatedAvail, error: updErr } = await supabase
        .from('availability')
        .update({ is_booked: true, updated_at: new Date().toISOString() })
        .eq('id', chosenAvailability.id)
        .eq('is_booked', false)
        .select('id, therapist_id, start_time, end_time')
        .single()
      if (updErr || !updatedAvail) return { success: false, error: (updErr && updErr.message) || '创建预约时发生错误' }

      let therapistIdForBookings = null
      const { data: tByUser } = await supabase
        .from('therapists')
        .select('id')
        .eq('user_id', String(picked.user_id))
        .maybeSingle()
      if (tByUser && tByUser.id) therapistIdForBookings = tByUser.id
      if (!therapistIdForBookings) return { success: false, error: '创建预约失败：未找到对应咨询师记录' }

      const { data: inserted, error: insErr } = await supabase
        .from('bookings')
        .insert({
          client_user_id: String(userId),
          therapist_id: therapistIdForBookings,
          session_date: updatedAvail.start_time,
          duration_minutes: 60,
          status: 'confirmed'
        })
        .select('id')
        .single()
      if (insErr || !inserted) return { success: false, error: (insErr && insErr.message) || '创建预约时发生错误' }

      return {
        success: true,
        data: {
          bookingId: inserted.id,
          therapistName: picked.name,
          dateTime: params.dateTime,
          message: `预约成功！您已预约 ${picked.name} 在 ${new Date(params.dateTime).toLocaleString('zh-CN')} 的咨询时间。`
        }
      }
    }

    return {
      success: true,
      data: {
        bookingId: booking,
        therapistName: picked.name,
        dateTime: params.dateTime,
        message: `预约成功！您已预约 ${picked.name} 在 ${new Date(params.dateTime).toLocaleString('zh-CN')} 的咨询时间。`
      }
    }
  } catch (error) {
    return { success: false, error: '创建预约时发生错误' }
  }
}
