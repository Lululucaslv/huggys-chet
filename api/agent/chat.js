const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req, res) {
  console.log('Agent API called with method:', req.method)
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const openaiApiKey = process.env.OPENAI_API_KEY

  console.log('Environment variables check:', {
    supabaseUrl: !!supabaseUrl,
    supabaseServiceKey: !!supabaseServiceKey,
    openaiApiKey: !!openaiApiKey
  })

  if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
    console.error('Missing required environment variables')
    return res.status(500).json({ error: 'Server configuration error' })
  }

  console.log('Creating Supabase client...')
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    console.log('Request body:', req.body)
    const { tool, userId, sessionId, messages, userMessage } = req.body

    if (tool === 'generatePreSessionSummary') {
      console.log('Generating pre-session summary for userId:', userId)
      const summary = await generatePreSessionSummary(userId, supabase, openaiApiKey)
      return res.status(200).json({ success: true, data: summary })
    }

    if (tool === 'chatWithTools') {
      console.log('Handling chat with tools for userId:', userId)
      const response = await handleChatWithTools(messages, userMessage, userId, supabase, openaiApiKey)
      return res.status(200).json({ success: true, data: response })
    }

    console.log('Unknown tool requested:', tool)
    return res.status(400).json({ error: 'Unknown tool requested' })
  } catch (error) {
    console.error('Agent API Error:', error)
    console.error('Error stack:', error.stack)
    return res.status(500).json({ error: 'Internal server error', details: error.message })
  }
}

async function handleChatWithTools(messages, userMessage, userId, supabase, openaiApiKey) {
  console.log('handleChatWithTools called with:', { messagesCount: messages?.length, userMessage, userId })
  try {
    const tools = [
      {
        type: "function",
        function: {
          name: "getTherapistAvailability",
          description: "查询指定咨询师在特定日期范围内的可预约时间段",
          parameters: {
            type: "object",
            properties: {
              therapistName: {
                type: "string",
                description: "咨询师的姓名"
              },
              startDate: {
                type: "string",
                description: "查询开始日期 (YYYY-MM-DD格式)"
              },
              endDate: {
                type: "string",
                description: "查询结束日期 (YYYY-MM-DD格式)"
              }
            },
            required: ["therapistName", "startDate", "endDate"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "createBooking",
          description: "为用户创建新的咨询预约",
          parameters: {
            type: "object",
            properties: {
              therapistName: {
                type: "string",
                description: "咨询师的姓名"
              },
              dateTime: {
                type: "string",
                description: "预约的日期和时间 (ISO 8601格式)"
              },
              duration: {
                type: "number",
                description: "预约时长（分钟）",
                default: 60
              }
            },
            required: ["therapistName", "dateTime"]
          }
        }
      }
    ]

    const conversationMessages = [
      {
        role: "system",
        content: `你是Huggy AI，一个专业而温暖的AI心理咨询助手。你现在具有以下工具调用能力：

1. getTherapistAvailability - 查询咨询师的可预约时间
2. createBooking - 为用户创建预约

当用户表达预约意图时，你应该：
1. 首先使用getTherapistAvailability工具查询可用时间
2. 向用户展示可选的时间段
3. 当用户确认时间后，使用createBooking工具创建预约

请用温暖、专业的语调与用户交流，并在需要时主动调用相应的工具。`
      },
      ...messages,
      { role: "user", content: userMessage }
    ]

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: conversationMessages,
        tools: tools,
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 1500
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const aiResponse = await response.json()
    const message = aiResponse.choices[0].message

    if (message.tool_calls) {
      const toolResults = []
      
      for (const toolCall of message.tool_calls) {
        const functionName = toolCall.function.name
        const functionArgs = JSON.parse(toolCall.function.arguments)
        
        let toolResult
        if (functionName === 'getTherapistAvailability') {
          toolResult = await getTherapistAvailability(functionArgs, supabase)
        } else if (functionName === 'createBooking') {
          toolResult = await createBooking(functionArgs, userId, supabase)
        }
        
        toolResults.push({
          tool_call_id: toolCall.id,
          role: "tool",
          content: JSON.stringify(toolResult)
        })
      }

      const finalMessages = [
        ...conversationMessages,
        message,
        ...toolResults
      ]

      const finalResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: finalMessages,
          temperature: 0.7,
          max_tokens: 1500
        })
      })

      if (!finalResponse.ok) {
        throw new Error(`OpenAI API error: ${finalResponse.status}`)
      }

      const finalAiResponse = await finalResponse.json()
      return {
        message: finalAiResponse.choices[0].message.content,
        toolCalls: message.tool_calls,
        toolResults: toolResults
      }
    }

    return {
      message: message.content,
      toolCalls: null,
      toolResults: null
    }

  } catch (error) {
    console.error('Error in handleChatWithTools:', error)
    throw error
  }
}

async function getTherapistAvailability(args, supabase) {
  try {
    const { therapistName, startDate, endDate } = args
    
    const { data: therapist, error: therapistError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('full_name', therapistName)
      .eq('role', 'THERAPIST')
      .single()

    if (therapistError || !therapist) {
      return {
        success: false,
        error: `未找到名为 "${therapistName}" 的咨询师`
      }
    }

    const { data: availability, error: availabilityError } = await supabase
      .from('availability')
      .select('id, start_time, end_time')
      .eq('therapist_id', therapist.id)
      .eq('is_booked', false)
      .gte('start_time', startDate)
      .lte('start_time', endDate + 'T23:59:59')
      .order('start_time', { ascending: true })

    if (availabilityError) {
      return {
        success: false,
        error: '查询可预约时间时发生错误'
      }
    }

    return {
      success: true,
      therapistName: therapistName,
      availableSlots: availability.map(slot => ({
        id: slot.id,
        startTime: slot.start_time,
        endTime: slot.end_time
      }))
    }

  } catch (error) {
    console.error('Error in getTherapistAvailability:', error)
    return {
      success: false,
      error: '查询过程中发生错误'
    }
  }
}

async function createBooking(args, userId, supabase) {
  try {
    const { therapistName, dateTime, duration = 60 } = args
    
    const { data: therapist, error: therapistError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('full_name', therapistName)
      .eq('role', 'THERAPIST')
      .single()

    if (therapistError || !therapist) {
      return {
        success: false,
        error: `未找到名为 "${therapistName}" 的咨询师`
      }
    }

    const startTime = new Date(dateTime)
    const endTime = new Date(startTime.getTime() + duration * 60000)

    const { data: availability, error: availabilityError } = await supabase
      .from('availability')
      .select('id')
      .eq('therapist_id', therapist.id)
      .eq('is_booked', false)
      .lte('start_time', startTime.toISOString())
      .gte('end_time', endTime.toISOString())
      .single()

    if (availabilityError || !availability) {
      return {
        success: false,
        error: '该时间段不可预约或已被预约'
      }
    }

    const { data: booking, error: bookingError } = await supabase.rpc('create_booking', {
      availability_id_to_book: availability.id,
      client_id_to_book: userId
    })

    if (bookingError) {
      return {
        success: false,
        error: '创建预约时发生错误'
      }
    }

    return {
      success: true,
      bookingId: booking,
      therapistName: therapistName,
      dateTime: dateTime,
      duration: duration,
      message: '预约创建成功！'
    }

  } catch (error) {
    console.error('Error in createBooking:', error)
    return {
      success: false,
      error: '预约过程中发生错误'
    }
  }
}

async function generatePreSessionSummary(userId, supabase, openaiApiKey) {
  try {
    const { data: chatMessages, error: chatError } = await supabase
      .from('chat_messages')
      .select('message, role, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (chatError) {
      throw new Error(`Failed to fetch chat messages: ${chatError.message}`)
    }

    if (!chatMessages || chatMessages.length === 0) {
      return {
        summary: '该来访者尚未进行过AI聊天对话，暂无聊天记录可供分析。',
        keyTopics: [],
        emotionalState: '未知',
        concernAreas: [],
        recommendations: ['建议在会谈开始时了解来访者的基本情况和当前关注的问题。']
      }
    }

    const conversationHistory = chatMessages
      .reverse()
      .map(msg => `${msg.role === 'user' ? '来访者' : 'AI助手'}: ${msg.message}`)
      .join('\n')

    const systemPrompt = `你是一位专业的心理咨询师助手。请基于以下来访者与AI助手的聊天记录，生成一份简洁而专业的会前摘要报告。

聊天记录：
${conversationHistory}

请以JSON格式返回分析结果，包含以下字段：
{
  "summary": "整体情况摘要（2-3句话）",
  "keyTopics": ["主要讨论话题1", "主要讨论话题2", "主要讨论话题3"],
  "emotionalState": "情绪状态评估",
  "concernAreas": ["关注领域1", "关注领域2"],
  "recommendations": ["建议1", "建议2", "建议3"]
}

请确保分析客观、专业，保护来访者隐私，避免过度解读。`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const aiResponse = await response.json()
    const summaryText = aiResponse.choices[0].message.content

    try {
      const summaryData = JSON.parse(summaryText)
      return summaryData
    } catch (parseError) {
      return {
        summary: summaryText,
        keyTopics: ['解析错误'],
        emotionalState: '需要进一步评估',
        concernAreas: ['需要进一步分析'],
        recommendations: ['建议查看原始聊天记录进行人工分析']
      }
    }

  } catch (error) {
    console.error('Error generating pre-session summary:', error)
    throw error
  }
}
