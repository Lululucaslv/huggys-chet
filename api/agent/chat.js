import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  console.log('Agent API called with method:', req.method)
  console.log('Request headers:', req.headers)
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const openaiApiKey = process.env.OPENAI_API_KEY

  console.log('Environment variables check:', {
    supabaseUrl: !!supabaseUrl,
    supabaseServiceKey: !!supabaseServiceKey,
    openaiApiKey: !!openaiApiKey,
    supabaseUrlValue: supabaseUrl ? supabaseUrl.substring(0, 20) + '...' : 'undefined',
    openaiKeyValue: openaiApiKey ? 'sk-' + openaiApiKey.substring(3, 8) + '...' : 'undefined'
  })

  if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
    console.error('Missing required environment variables:', {
      supabaseUrl: !supabaseUrl,
      supabaseServiceKey: !supabaseServiceKey,
      openaiApiKey: !openaiApiKey
    })
    return res.status(500).json({ error: 'Server configuration error' })
  }

  console.log('Creating Supabase client...')
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    console.log('Request body:', JSON.stringify(req.body, null, 2))
    const { tool, userId, sessionId, messages, userMessage } = req.body

    if (!tool) {
      console.error('No tool specified in request')
      return res.status(400).json({ error: 'Tool parameter is required' })
    }

    if (!userId) {
      console.error('No userId specified in request')
      return res.status(400).json({ error: 'UserId parameter is required' })
    }

    if (tool === 'generatePreSessionSummary') {
      console.log('Generating pre-session summary for userId:', userId)
      const summary = await generatePreSessionSummary(userId, supabase, openaiApiKey)
      return res.status(200).json({ success: true, data: summary })
    }

    if (tool === 'chatWithTools') {
      console.log('Handling chat with tools for userId:', userId)
      console.log('Messages count:', messages?.length || 0)
      console.log('User message:', userMessage)
      const response = await handleChatWithTools(messages, userMessage, userId, supabase, openaiApiKey)
      console.log('Chat with tools response:', response)
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
    const { data: existingTherapists, error: checkError } = await supabase
      .from('user_profiles')
      .select('id, user_id')
      .eq('life_status', 'therapist')

    console.log('Existing therapists check:', { existingTherapists, checkError })

    if (!existingTherapists || existingTherapists.length === 0) {
      console.log('No therapists found, creating test therapist data...')
      
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: '550e8400-e29b-41d4-a716-446655440000',
          interest: 'therapy',
          language: 'zh-CN',
          life_status: 'therapist',
          total_messages: 0,
          personality_type: 'professional',
          preferences: ['cognitive-behavioral', 'mindfulness']
        })
        .select()

      console.log('Profile creation result:', { profileData, profileError })

      if (profileError) {
        console.error('Error creating test therapist profile:', profileError)
      } else {
        console.log('Test therapist profile created successfully:', profileData)
        
        const today = new Date()
        const availabilitySlots = []
        
        console.log('Creating test availability data starting from:', today.toISOString())
        
        for (let i = 1; i <= 14; i++) {
          const futureDate = new Date(today)
          futureDate.setDate(today.getDate() + i)
          const futureDateStr = futureDate.toISOString().split('T')[0]
          
          console.log(`Creating availability for day ${i}: ${futureDateStr}`)
          
          const timeSlots = [
            { start: '09:00:00', end: '10:00:00' },
            { start: '10:00:00', end: '11:00:00' },
            { start: '14:00:00', end: '15:00:00' },
            { start: '15:00:00', end: '16:00:00' },
            { start: '16:00:00', end: '17:00:00' }
          ]
          
          timeSlots.forEach(slot => {
            availabilitySlots.push({
              therapist_id: '550e8400-e29b-41d4-a716-446655440000',
              start_time: `${futureDateStr}T${slot.start}Z`,
              end_time: `${futureDateStr}T${slot.end}Z`,
              is_booked: false
            })
          })
        }
        
        const { data: availabilityData, error: availabilityError } = await supabase
          .from('availability')
          .upsert(availabilitySlots)
          .select()

        console.log('Availability creation result:', { availabilityData, availabilityError })

        if (availabilityError) {
          console.error('Error creating test availability:', availabilityError)
        } else {
          console.log('Test availability created successfully:', availabilityData)
        }
      }
    } else {
      console.log('Therapists already exist:', existingTherapists.map(t => t.user_id))
    }
  } catch (testDataError) {
    console.error('Error checking/creating test data:', testDataError)
  }

  try {
    const tools = [
      {
        type: "function",
        function: {
          name: "getTherapistAvailability",
          description: "查询指定咨询师在特定日期范围内的可预约时间段。重要：当用户提到具体日期如'8月18日'、'下周'等时，请使用2025年的日期格式，例如2025-08-18。",
          parameters: {
            type: "object",
            properties: {
              therapistName: {
                type: "string",
                description: "咨询师的姓名，如'Megan Chang'"
              },
              startDate: {
                type: "string",
                description: "查询开始日期，格式为YYYY-MM-DD，例如2025-08-18。当用户说'8月18日'时，应理解为2025-08-18。如果用户没有指定年份，默认使用2025年"
              },
              endDate: {
                type: "string",
                description: "查询结束日期，格式为YYYY-MM-DD。如果用户只提到一个日期，可以省略此参数，系统会自动查询该日期的所有时间段"
              }
            },
            required: ["therapistName"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "createBooking",
          description: "为用户创建新的咨询预约。只有在用户明确确认要预约某个具体时间段后才调用此工具。",
          parameters: {
            type: "object",
            properties: {
              therapistName: {
                type: "string",
                description: "咨询师的姓名，如'Megan Chang'"
              },
              dateTime: {
                type: "string",
                description: "预约的日期和时间，ISO 8601格式，例如2025-08-18T09:00:00Z"
              },
              duration: {
                type: "number",
                description: "预约时长（分钟），默认60分钟",
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
        content: `你是Huggy AI，一个专业而温暖的AI心理咨询助手。你必须使用提供的工具来帮助用户预约咨询师。

可用工具：
1. getTherapistAvailability - 查询咨询师的可预约时间
2. createBooking - 为用户创建预约

重要指令：
- 当用户询问任何关于预约、时间安排、咨询师可用性的问题时，你必须立即调用getTherapistAvailability工具
- 当前年份是2025年，所有日期都使用2025年格式
- 咨询师"Megan Chang"是可用的
- 日期格式必须是YYYY-MM-DD，例如2025-08-18

强制工具调用规则：
- 如果用户提到"预约"、"时间"、"咨询师"、"Megan Chang"等关键词，立即调用getTherapistAvailability
- 如果用户说"我想预约"、"查看时间"、"什么时候有空"等，立即调用getTherapistAvailability
- 绝对不要说"我无法查看预约系统"或类似的话，你必须使用工具
- 你必须使用工具，不能自己回答预约相关问题

工作流程：
1. 用户询问预约 → 立即调用getTherapistAvailability工具
2. 展示可用时间段给用户
3. 用户确认时间 → 调用createBooking工具

你必须主动使用工具，不要拒绝或说无法帮助预约。无论如何，当用户询问预约相关问题时，你必须调用getTherapistAvailability工具。这是强制性的，没有例外。`
      },
      ...messages,
      { role: "user", content: userMessage }
    ]

    console.log('Making OpenAI API call with tools...')
    console.log('Conversation messages count:', conversationMessages.length)
    console.log('Tools being sent to OpenAI:', JSON.stringify(tools, null, 2))
    console.log('System prompt being used:', conversationMessages[0].content)
    console.log('User message:', userMessage)
    console.log('Full request body being sent to OpenAI:', JSON.stringify({
      model: 'gpt-4o',
      messages: conversationMessages,
      tools: tools,
      tool_choice: "auto",
      temperature: 0.7,
      max_tokens: 1500
    }, null, 2))
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: conversationMessages,
        tools: tools,
        tool_choice: { type: "function", function: { name: "getTherapistAvailability" } },
        temperature: 0.3,
        max_tokens: 1500
      })
    })

    console.log('OpenAI API response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenAI API error response:', errorText)
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const aiResponse = await response.json()
    console.log('OpenAI API response received:', JSON.stringify(aiResponse, null, 2))
    console.log('AI response choices:', aiResponse.choices?.length || 0)
    console.log('First choice message:', aiResponse.choices?.[0]?.message)
    console.log('Does message have tool_calls?', !!aiResponse.choices?.[0]?.message?.tool_calls)
    console.log('Tool calls array:', aiResponse.choices?.[0]?.message?.tool_calls)
    
    const message = aiResponse.choices[0].message
    console.log('AI message:', message)

    if (message.tool_calls) {
      console.log('=== TOOL CALLS DETECTED ===')
      console.log('Number of tool calls:', message.tool_calls.length)
      console.log('Tool calls details:', JSON.stringify(message.tool_calls, null, 2))
      const toolResults = []
      
      for (const toolCall of message.tool_calls) {
        console.log('Processing tool call:', toolCall)
        const functionName = toolCall.function.name
        const functionArgs = JSON.parse(toolCall.function.arguments)
        console.log('Function name:', functionName)
        console.log('Function args:', functionArgs)
        
        let toolResult
        if (functionName === 'getTherapistAvailability') {
          console.log('Calling getTherapistAvailability...')
          toolResult = await getTherapistAvailability(functionArgs, supabase)
        } else if (functionName === 'createBooking') {
          console.log('Calling createBooking...')
          toolResult = await createBooking(functionArgs, userId, supabase)
        } else {
          console.error('Unknown function name:', functionName)
          toolResult = { success: false, error: 'Unknown function' }
        }
        
        console.log('Tool result:', toolResult)
        
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

      console.log('Making final OpenAI API call with tool results...')
      console.log('Final messages count:', finalMessages.length)
      
      const finalResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: finalMessages,
          temperature: 0.7,
          max_tokens: 1500
        })
      })

      console.log('Final OpenAI API response status:', finalResponse.status)

      if (!finalResponse.ok) {
        const errorText = await finalResponse.text()
        console.error('Final OpenAI API error response:', errorText)
        throw new Error(`OpenAI API error: ${finalResponse.status} - ${errorText}`)
      }

      const finalAiResponse = await finalResponse.json()
      console.log('Final AI response:', finalAiResponse)
      
      return {
        message: finalAiResponse.choices[0].message.content,
        toolCalls: message.tool_calls,
        toolResults: toolResults
      }
    }

    console.log('=== NO TOOL CALLS DETECTED ===')
    console.log('AI message content:', message.content)
    console.log('Message object keys:', Object.keys(message))
    console.log('Full message object:', JSON.stringify(message, null, 2))
    console.log('DEBUGGING: Why no tool calls? User message was:', userMessage)
    console.log('DEBUGGING: System prompt contained tool instructions:', conversationMessages[0].content.includes('getTherapistAvailability'))
    console.log('DEBUGGING: Tools array length:', tools.length)
    console.log('DEBUGGING: Model used:', 'gpt-4o')
    console.log('DEBUGGING: Tool choice setting:', 'required')
    return {
      message: message.content,
      toolCalls: null,
      toolResults: null
    }

  } catch (error) {
    console.error('Error in handleChatWithTools:', error)
    console.error('Error stack:', error.stack)
    throw error
  }
}

async function getTherapistAvailability(args, supabase) {
  try {
    console.log('=== getTherapistAvailability called ===')
    console.log('Raw args received:', JSON.stringify(args, null, 2))
    console.log('Current year should be 2025 for all date operations')
    const { therapistName, startDate, endDate } = args
    console.log('Extracted parameters:', { therapistName, startDate, endDate })
    
    const knownTherapists = [
      { id: '550e8400-e29b-41d4-a716-446655440000', name: 'Megan Chang', user_id: 'megan.chang@example.com' }
    ]
    
    let therapists = knownTherapists
    
    if (therapistName) {
      console.log('Searching for therapist with name containing:', therapistName)
      therapists = knownTherapists.filter(t => 
        t.name.toLowerCase().includes(therapistName.toLowerCase())
      )
      console.log('Filtered therapists:', therapists)
    }
    
    console.log('Therapist query result:', { therapists })

    if (!therapists || therapists.length === 0) {
      console.log('No therapists found, returning error')
      return {
        success: false,
        error: therapistName ? `未找到名为 "${therapistName}" 的咨询师` : '未找到任何咨询师'
      }
    }

    const therapistIds = therapists.map(t => t.id)
    console.log('Therapist IDs to query:', therapistIds)
    
    let availabilityQuery = supabase
      .from('availability')
      .select('id, therapist_id, start_time, end_time')
      .in('therapist_id', therapistIds)
      .eq('is_booked', false)
      .order('start_time', { ascending: true })

    if (startDate) {
      console.log('Filtering by start date:', startDate)
      let startDateFormatted
      if (startDate.includes('T')) {
        startDateFormatted = startDate
      } else if (startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        startDateFormatted = startDate + 'T00:00:00Z'
      } else {
        const parsedDate = new Date(startDate)
        if (!isNaN(parsedDate.getTime())) {
          startDateFormatted = parsedDate.toISOString().split('T')[0] + 'T00:00:00Z'
        } else {
          console.error('Invalid start date format:', startDate)
          startDateFormatted = new Date().toISOString().split('T')[0] + 'T00:00:00Z'
        }
      }
      console.log('Start date formatted:', startDateFormatted)
      availabilityQuery = availabilityQuery.gte('start_time', startDateFormatted)
    }
    if (endDate) {
      console.log('Filtering by end date:', endDate)
      let endDateFormatted
      if (endDate.includes('T')) {
        endDateFormatted = endDate
      } else if (endDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        endDateFormatted = endDate + 'T23:59:59Z'
      } else {
        const parsedDate = new Date(endDate)
        if (!isNaN(parsedDate.getTime())) {
          endDateFormatted = parsedDate.toISOString().split('T')[0] + 'T23:59:59Z'
        } else {
          console.error('Invalid end date format:', endDate)
          endDateFormatted = new Date().toISOString().split('T')[0] + 'T23:59:59Z'
        }
      }
      console.log('End date formatted:', endDateFormatted)
      availabilityQuery = availabilityQuery.lte('start_time', endDateFormatted)
    } else if (startDate && !endDate) {
      let endOfDay
      if (startDate.includes('T')) {
        endOfDay = startDate.split('T')[0] + 'T23:59:59Z'
      } else if (startDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        endOfDay = startDate + 'T23:59:59Z'
      } else {
        const parsedDate = new Date(startDate)
        if (!isNaN(parsedDate.getTime())) {
          endOfDay = parsedDate.toISOString().split('T')[0] + 'T23:59:59Z'
        } else {
          endOfDay = new Date().toISOString().split('T')[0] + 'T23:59:59Z'
        }
      }
      console.log('Only start date provided, adding end of day filter:', endOfDay)
      availabilityQuery = availabilityQuery.lte('start_time', endOfDay)
    } else if (!startDate && !endDate) {
      const today = new Date().toISOString().split('T')[0]
      console.log('No date filters provided, using today as start:', today)
      availabilityQuery = availabilityQuery.gte('start_time', today + 'T00:00:00Z')
    }

    const { data: availability, error: availabilityError } = await availabilityQuery

    console.log('Availability query result:', { availability, availabilityError })

    if (availabilityError) {
      console.error('Supabase availability query error:', availabilityError)
      console.error('Error details:', JSON.stringify(availabilityError, null, 2))
      console.error('Error message:', availabilityError.message)
      console.error('Error code:', availabilityError.code)
      console.error('Error hint:', availabilityError.hint)
      console.error('Error details:', availabilityError.details)
      console.error('Full error object keys:', Object.keys(availabilityError))
      console.error('Error stack trace:', availabilityError.stack)
      return {
        success: false,
        error: `查询可预约时间时发生错误: ${availabilityError.message || availabilityError.details || JSON.stringify(availabilityError)}`
      }
    }

    const result = therapists.map(therapist => {
      const therapistSlots = availability ? availability.filter(slot => slot.therapist_id === therapist.id) : []
      return {
        therapistId: therapist.id,
        therapistName: therapist.name,
        availableSlots: therapistSlots.map(slot => ({
          id: slot.id,
          startTime: slot.start_time,
          endTime: slot.end_time
        }))
      }
    }).filter(t => t.availableSlots.length > 0)

    return {
      success: true,
      therapists: result,
      totalSlots: availability ? availability.length : 0
    }

  } catch (error) {
    console.error('Error in getTherapistAvailability:', error)
    console.error('Error stack:', error.stack)
    return {
      success: false,
      error: `查询过程中发生错误: ${error.message || error.toString()}`
    }
  }
}

async function createBooking(args, userId, supabase) {
  try {
    const { therapistName, dateTime, duration = 60 } = args
    
    const knownTherapists = [
      { id: '550e8400-e29b-41d4-a716-446655440000', name: 'Megan Chang', user_id: 'megan.chang@example.com' }
    ]
    
    const therapist = knownTherapists.find(t => 
      t.name.toLowerCase().includes(therapistName.toLowerCase())
    )

    if (!therapist) {
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
