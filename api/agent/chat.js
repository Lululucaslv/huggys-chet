import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const { tool, userMessage, userId } = body

    if (!tool || !userMessage || !userId) {
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

    const result = await handleChatWithTools(userMessage, userId, openai, supabase)
    res.status(200).json(result)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message })
  }
}

async function handleChatWithTools(userMessage, userId, openai, supabase) {
  console.log('🔥 v36 - Handling chat with tools')
  
  const tools = [
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

  const conversationMessages = [
    {
      role: 'system',
      content: `你是Huggy AI，一个专业而温暖的AI心理咨询助手。你必须使用提供的工具来帮助用户预约咨询师。

可用工具：
1. getTherapistAvailability - 查询咨询师的可预约时间
2. createBooking - 为用户创建预约

核心规则：你必须优先使用工具来回答你能回答的问题。严禁自行编造任何关于日程、可用时间或预约状态的信息。在执行任何会修改数据的破坏性操作（如createBooking）之前，必须先向用户进行二次确认。

重要指令：
- 当用户询问任何关于预约、时间安排、咨询师可用性的问题时，你必须立即调用getTherapistAvailability工具
- 当前年份是2025年，所有日期都使用2025年格式
- 绝对不要说"我无法查看预约系统"或类似的话，你必须使用工具
- 你必须使用工具，不能自己回答预约相关问题
- 对于任何预约相关的询问，你的第一反应必须是调用getTherapistAvailability工具

工作流程：
1. 用户询问预约 → 立即调用getTherapistAvailability工具
2. 展示可用时间段给用户
3. 用户确认时间 → 调用createBooking工具

你必须主动使用工具，不要拒绝或说无法帮助预约。无论如何，当用户询问预约相关问题时，你必须调用getTherapistAvailability工具。这是强制性的，没有例外。`
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
      tools: tools,
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
            } else if (tr.result?.error) {
              parts.push(`工具返回错误：${tr.result.error}`)
            }
          }
          if (parts.length > 0) {
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

async function getTherapistAvailability(params, supabase) {
  try {
    console.log('🔥 v36 - getTherapistAvailability called with params:', params)
    
    const knownTherapists = {
      'Megan Chang': '550e8400-e29b-41d4-a716-446655440000'
    }
    
    const therapists = Object.keys(knownTherapists).filter(name => 
      name.toLowerCase().includes(params.therapistName.toLowerCase())
    )
    
    if (therapists.length === 0) {
      return {
        success: false,
        error: `未找到名为 "${params.therapistName}" 的咨询师。可用的咨询师有：${Object.keys(knownTherapists).join(', ')}`
      }
    }
    
    const therapistName = therapists[0]
    const therapistId = knownTherapists[therapistName]
    
    console.log('🔥 v36 - Querying availability for therapist:', therapistName, 'ID:', therapistId)
    
    let availabilityQuery = supabase
      .from('availability')
      .select('*')
      .eq('therapist_id', therapistId)
      .eq('is_booked', false)
      .order('start_time', { ascending: true })
    
    if (params.startDate) {
      availabilityQuery = availabilityQuery.gte('start_time', params.startDate + 'T00:00:00Z')
    }
    
    if (params.endDate) {
      availabilityQuery = availabilityQuery.lte('start_time', params.endDate + 'T23:59:59Z')
    }
    
    const { data: availability, error } = await availabilityQuery
    
    if (error) {
      console.error('🔥 v36 - Database error:', error)
      return {
        success: false,
        error: '查询可预约时间时发生错误'
      }
    }
    
    if (!availability || availability.length === 0) {
      return {
        success: true,
        data: {
          therapistName: therapistName,
          availableSlots: [],
          message: `${therapistName} 在指定时间段内暂无可预约时间。`
        }
      }
    }
    
    const result = {
      success: true,
      data: {
        therapistName: therapistName,
        availableSlots: availability.map(slot => ({
          id: slot.id,
          startTime: slot.start_time,
          endTime: slot.end_time,
          date: new Date(slot.start_time).toLocaleDateString('zh-CN'),
          time: new Date(slot.start_time).toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
          })
        })),
        message: `找到 ${availability.length} 个可预约时间段。`
      }
    }
    
    console.log('🔥 v36 - Returning availability result:', result)
    return result
    
  } catch (error) {
    console.error('🔥 v36 - Error in getTherapistAvailability:', error)
    return {
      success: false,
      error: '获取咨询师可预约时间时发生错误'
    }
  }
}

async function createBooking(params, userId, supabase) {
  try {
    console.log('🔥 v36 - createBooking called with params:', params, 'userId:', userId)
    
    const knownTherapists = {
      'Megan Chang': '550e8400-e29b-41d4-a716-446655440000'
    }
    
    const therapist = Object.keys(knownTherapists).find(name => 
      name.toLowerCase().includes(params.therapistName.toLowerCase())
    )
    
    if (!therapist) {
      return {
        success: false,
        error: `未找到名为 "${params.therapistName}" 的咨询师`
      }
    }
    
    const therapistId = knownTherapists[therapist]
    
    const { data: availability, error: availabilityError } = await supabase
      .from('availability')
      .select('*')
      .eq('therapist_id', therapistId)
      .eq('start_time', params.dateTime)
      .eq('is_booked', false)
      .single()
    
    if (availabilityError || !availability) {
      return {
        success: false,
        error: '该时间段不可预约或已被预订'
      }
    }
    
    const { data: booking, error: bookingError } = await supabase.rpc('create_booking', {
      availability_id_to_book: availability.id,
      client_id_to_book: userId
    })
    
    if (bookingError) {
      console.error('🔥 v36 - Booking error:', bookingError)
      return {
        success: false,
        error: '创建预约时发生错误'
      }
    }
    
    return {
      success: true,
      data: {
        bookingId: booking,
        therapistName: therapist,
        dateTime: params.dateTime,
        message: `预约成功！您已预约 ${therapist} 在 ${new Date(params.dateTime).toLocaleString('zh-CN')} 的咨询时间。`
      }
    }
    
  } catch (error) {
    console.error('🔥 v36 - Error in createBooking:', error)
    return {
      success: false,
      error: '创建预约时发生错误'
    }
  }
}
