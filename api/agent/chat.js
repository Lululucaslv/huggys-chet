import OpenAI from 'openai'
import { OpenAIStream, StreamingTextResponse } from 'ai'

export const runtime = 'edge'

export default async function handler(req) {
  console.log('🔥 v32 - CHAT ENDPOINT HIT - CLEAN SIMPLIFIED VERSION')
  
  if (req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method)
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    console.log('🔥 v32 - Parsing request body...')
    const body = await req.json()
    console.log('🔥 v32 - Request body received')
    
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

    console.log('🔥 v32 - Environment check passed')

    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ Missing OpenAI API key')
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('🔥 v32 - Creating OpenAI client...')
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })

    console.log('🔥 v32 - Creating conversation messages...')
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

    console.log('🔥 v32 - Making streaming OpenAI call...')
    const streamingResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: conversationMessages,
      temperature: 0.3,
      max_tokens: 1500,
      stream: true
    })
    
    console.log('🔥 v32 - Creating stream response...')
    const stream = OpenAIStream(streamingResponse)
    return new StreamingTextResponse(stream)

  } catch (error) {
    console.error('❌ v32 Handler error:', error)
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
