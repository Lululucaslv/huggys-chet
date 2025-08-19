import OpenAI from 'openai'
import { OpenAIStream, StreamingTextResponse } from 'ai'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

export default async function handler(req) {
  console.log('🔥 v33 - CHAT ENDPOINT WITH TOOL CALLING RESTORED')
  
  if (req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method)
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    console.log('🔥 v33 - Parsing request body...')
    const body = await req.json()
    console.log('🔥 v33 - Request body received')
    
    const { tool, userMessage, userId } = body

    if (!tool || !userMessage || !userId) {
      console.log('❌ Missing required parameters')
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (tool !== 'chatWithTools') {
      console.log('❌ Invalid tool specified:', tool)
      return new Response(JSON.stringify({ error: 'Invalid tool specified' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('🔥 v33 - Environment check...')
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ Missing OpenAI API key')
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Missing Supabase configuration')
      return new Response(JSON.stringify({ error: 'Database configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('🔥 v33 - Creating Supabase client...')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    console.log('🔥 v33 - Calling handleChatWithTools...')
    return await handleChatWithTools(userMessage, userId, supabase)

  } catch (error) {
    console.error('❌ v33 Handler error:', error)
    console.error('❌ Error message:', error.message)
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function handleChatWithTools(userMessage, userId, supabase) {
  try {
    console.log('🔥 v33 - handleChatWithTools started')
    console.log('🔥 v33 - Message:', userMessage?.substring(0, 100))
    console.log('🔥 v33 - UserId:', userId)

    const tools = [
      {
        type: "function",
        function: {
          name: "getTherapistAvailability",
          description: "当用户想要查询、寻找、预订、或询问某位咨询师的空闲时间、可预约时间段或日程安排时，必须使用此工具。",
          parameters: {
            type: "object",
            properties: {
              therapistName: {
                type: "string",
                description: "咨询师的姓名，如'Megan Chang'"
              },
              startDate: {
                type: "string",
                description: "查询开始日期，格式为YYYY-MM-DD，例如2025-08-19。当用户说'明天'时，应理解为2025-08-19。如果用户没有指定年份，默认使用2025年"
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
          description: "当用户在确认了具体的时间和咨询师后，明确表示希望\"确认预约\"、\"就订这个时间\"或\"帮我订一下\"时，使用此工具来最终锁定并创建预约。",
          parameters: {
            type: "object",
            properties: {
              therapistName: {
                type: "string",
                description: "咨询师的姓名，如'Megan Chang'"
              },
              dateTime: {
                type: "string",
                description: "预约的日期和时间，ISO 8601格式，例如2025-08-19T09:00:00Z"
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
        role: "user",
        content: userMessage
      }
    ]

    console.log('🔥 v33 - Creating OpenAI client...')
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })

    console.log('🔥 v33 - Step 1: Making non-streaming call to detect tool calls...')
    const initialResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: conversationMessages,
      tools: tools,
      tool_choice: "auto",
      temperature: 0.3,
      max_tokens: 1500,
      stream: false
    })

    console.log('🔥 v33 - Initial response received')
    const message_obj = initialResponse.choices[0].message
    
    if (message_obj.tool_calls && message_obj.tool_calls.length > 0) {
      console.log('🔥 v33 - TOOL CALLS DETECTED!')
      console.log('🔥 v33 - Tool calls:', message_obj.tool_calls)
      
      const toolMessages = [...conversationMessages, message_obj]
      
      for (const toolCall of message_obj.tool_calls) {
        console.log('🔥 v33 - Processing tool call:', toolCall.function.name)
        console.log('🔥 v33 - Arguments:', toolCall.function.arguments)
        
        try {
          const parsedArgs = JSON.parse(toolCall.function.arguments)
          let toolResult
          
          if (toolCall.function.name === 'getTherapistAvailability') {
            console.log('🔥 v33 - Calling getTherapistAvailability...')
            toolResult = await getTherapistAvailability(parsedArgs, supabase)
            console.log('🔥 v33 - getTherapistAvailability result:', toolResult)
          } else if (toolCall.function.name === 'createBooking') {
            console.log('🔥 v33 - Calling createBooking...')
            toolResult = await createBooking(parsedArgs, userId, supabase)
            console.log('🔥 v33 - createBooking result:', toolResult)
          } else {
            console.error('❌ Unknown function name:', toolCall.function.name)
            toolResult = { success: false, error: 'Unknown function' }
          }
          
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          })
          
        } catch (parseError) {
          console.error('❌ Error parsing tool arguments:', parseError)
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ success: false, error: 'Failed to parse arguments' })
          })
        }
      }
      
      console.log('🔥 v33 - Step 2: Making streaming call with tool results...')
      const finalResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: toolMessages,
        temperature: 0.3,
        max_tokens: 1500,
        stream: true
      })
      
      console.log('🔥 v33 - Creating final stream...')
      const finalStream = OpenAIStream(finalResponse)
      return new StreamingTextResponse(finalStream)
    }
    
    console.log('🔥 v33 - No tool calls detected, making streaming response...')
    const streamingResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: conversationMessages,
      temperature: 0.3,
      max_tokens: 1500,
      stream: true
    })
    
    console.log('🔥 v33 - Creating stream for non-tool response...')
    const stream = OpenAIStream(streamingResponse)
    return new StreamingTextResponse(stream)

  } catch (error) {
    console.error('❌ Error in handleChatWithTools:', error)
    console.error('❌ Error message:', error.message)
    console.error('❌ Error stack:', error.stack)
    throw error
  }
}

async function getTherapistAvailability(params, supabase) {
  try {
    console.log('🔥 v33 - getTherapistAvailability called with params:', params)
    
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
    
    console.log('🔥 v33 - Querying availability for therapist:', therapistName, 'ID:', therapistId)
    
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
      console.error('❌ Database error:', error)
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
    
    console.log('🔥 v33 - Returning availability result:', result)
    return result
    
  } catch (error) {
    console.error('❌ Error in getTherapistAvailability:', error)
    return {
      success: false,
      error: '获取咨询师可预约时间时发生错误'
    }
  }
}

async function createBooking(params, userId, supabase) {
  try {
    console.log('🔥 v33 - createBooking called with params:', params, 'userId:', userId)
    
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
      console.error('❌ Booking error:', bookingError)
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
    console.error('❌ Error in createBooking:', error)
    return {
      success: false,
      error: '创建预约时发生错误'
    }
  }
}
