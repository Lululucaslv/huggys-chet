import OpenAI from 'openai'
import { OpenAIStream, StreamingTextResponse } from 'ai'

export const runtime = 'edge'

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const { userMessage } = await req.json()

    if (!userMessage) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('User message:', userMessage)

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })

    const conversationMessages = [
      {
        role: "system",
        content: `你是一个专业的心理健康助手，专门帮助用户预约心理咨询师。
        
        请用中文回复，并提供清晰、有用的信息。`
      },
      {
        role: "user",
        content: userMessage
      }
    ]

    const streamingResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: conversationMessages,
      temperature: 0.3,
      max_tokens: 1500,
      stream: true
    })
    
    const stream = OpenAIStream(streamingResponse)
    return new StreamingTextResponse(stream)

  } catch (error) {
    console.error('Handler error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
