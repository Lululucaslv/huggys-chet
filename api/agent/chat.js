import OpenAI from 'openai'
import { OpenAIStream, StreamingTextResponse } from 'ai'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

export default async function handler(req) {
  console.log('🔥 v31 - CHAT ENDPOINT HIT - SIMPLIFIED VERSION')
  
  if (req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method)
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    console.log('🔥 v31 - Parsing request body...')
    const body = await req.json()
    console.log('🔥 v31 - Request body received')
    
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

    console.log('🔥 v31 - Environment check passed')

    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ Missing OpenAI API key')
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('🔥 v31 - Creating OpenAI client...')
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })

    console.log('🔥 v31 - Creating conversation messages...')
    const conversationMessages = [
      {
        role: "system",
        content: `你是一个专业的心理健康助手，专门帮助用户预约心理咨询师。

当用户询问咨询师的可预约时间时，你应该调用工具来查询实际的可预约时间。
请用中文回复，并提供清晰、有用的信息。`
      },
      {
        role: "user",
        content: userMessage
      }
    ]

    console.log('🔥 v31 - Making streaming OpenAI call...')
    const streamingResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: conversationMessages,
      temperature: 0.3,
      max_tokens: 1500,
      stream: true
    })
    
    console.log('🔥 v31 - Creating stream response...')
    const stream = OpenAIStream(streamingResponse)
    return new StreamingTextResponse(stream)

  } catch (error) {
    console.error('❌ v31 Handler error:', error)
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

async function handleChatWithTools(message, userId, supabase) {
  try {
    console.log('🔥 v30 - handleChatWithTools started')
    console.log('🔥 v30 - Message:', message?.substring(0, 100))
    console.log('🔥 v30 - UserId:', userId)

    const tools = [
      {
        type: "function",
        function: {
          name: "getTherapistAvailability",
          description: "Get available appointment slots for a specific therapist",
          parameters: {
            type: "object",
            properties: {
              therapistName: {
                type: "string",
                description: "Name of the therapist to check availability for"
              },
              startDate: {
                type: "string",
                description: "Start date for availability search (YYYY-MM-DD format, optional)"
              },
              endDate: {
                type: "string", 
                description: "End date for availability search (YYYY-MM-DD format, optional)"
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
          description: "Create a booking for a specific therapist at a specific time",
          parameters: {
            type: "object",
            properties: {
              therapistName: {
                type: "string",
                description: "Name of the therapist to book with"
              },
              dateTime: {
                type: "string",
                description: "Date and time for the appointment (ISO 8601 format)"
              }
            },
            required: ["therapistName", "dateTime"]
          }
        }
      }
    ]

    console.log('🔥 v30 - Tools defined, creating conversation messages...')

    const conversationMessages = [
      {
        role: "system",
        content: `你是一个专业的心理健康助手，专门帮助用户预约心理咨询师。你可以：

1. 查询咨询师的可预约时间
2. 帮助用户预约咨询师

当用户询问咨询师的可预约时间时，使用 getTherapistAvailability 函数。
当用户想要预约特定时间时，使用 createBooking 函数。

请用中文回复，并提供清晰、有用的信息。如果查询到可预约时间，请以易读的格式展示给用户。`
      },
      {
        role: "user",
        content: message
      }
    ]

    console.log('🔥 v30 - Creating OpenAI client...')
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })

    console.log('🔥 v30 - Step 1: Making non-streaming call to detect tool calls...')
    const initialResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: conversationMessages,
      tools: tools,
      tool_choice: "auto",
      temperature: 0.3,
      max_tokens: 1500,
      stream: false
    })

    console.log('🔥 v30 - Initial response received')
    console.log('🔥 v30 - Response choice:', initialResponse.choices[0])

    const message_obj = initialResponse.choices[0].message
    if (message_obj.tool_calls && message_obj.tool_calls.length > 0) {
      console.log('🔥 v30 - TOOL CALLS DETECTED!')
      console.log('🔥 v30 - Tool calls:', message_obj.tool_calls)
      
      const toolMessages = [...conversationMessages, message_obj]
      
      for (const toolCall of message_obj.tool_calls) {
        console.log('🔥 v30 - Processing tool call:', toolCall.function.name)
        console.log('🔥 v30 - Arguments:', toolCall.function.arguments)
        
        try {
          const parsedArgs = JSON.parse(toolCall.function.arguments)
          let toolResult
          
          if (toolCall.function.name === 'getTherapistAvailability') {
            console.log('🔥 v30 - Calling getTherapistAvailability...')
            toolResult = await getTherapistAvailability(parsedArgs, supabase)
            console.log('🔥 v30 - getTherapistAvailability result:', toolResult)
          } else if (toolCall.function.name === 'createBooking') {
            console.log('🔥 v30 - Calling createBooking...')
            toolResult = await createBooking(parsedArgs, userId, supabase)
            console.log('🔥 v30 - createBooking result:', toolResult)
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
      
      console.log('🔥 v30 - Step 2: Making streaming call with tool results...')
      const finalResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: toolMessages,
        temperature: 0.3,
        max_tokens: 1500,
        stream: true
      })
      
      console.log('🔥 v30 - Creating final stream...')
      const finalStream = OpenAIStream(finalResponse)
      return new StreamingTextResponse(finalStream)
    }
    
    console.log('🔥 v30 - No tool calls detected, making streaming response...')
    const streamingResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: conversationMessages,
      temperature: 0.3,
      max_tokens: 1500,
      stream: true
    })
    
    console.log('🔥 v30 - Creating stream for non-tool response...')
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
    console.log('getTherapistAvailability called with params:', params)
    
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
    
    console.log('Querying availability for therapist:', therapistName, 'ID:', therapistId)
    
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
      console.error('Database error:', error)
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
    
    console.log('Returning availability result:', result)
    return result
    
  } catch (error) {
    console.error('Error in getTherapistAvailability:', error)
    return {
      success: false,
      error: '获取咨询师可预约时间时发生错误'
    }
  }
}

async function createBooking(params, userId, supabase) {
  try {
    console.log('createBooking called with params:', params, 'userId:', userId)
    
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
      console.error('Booking error:', bookingError)
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
    console.error('Error in createBooking:', error)
    return {
      success: false,
      error: '创建预约时发生错误'
    }
  }
}
