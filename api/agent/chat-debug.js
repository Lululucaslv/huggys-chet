import OpenAI from 'openai'
import { OpenAIStream, StreamingTextResponse } from 'ai'

export const runtime = 'edge'

export default async function handler(req) {
  console.log('=== HANDLER ENTRY POINT ===')
  
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method)
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    console.log('=== PARSING REQUEST BODY ===')
    const body = await req.json()
    console.log('Request body:', body)
    
    const { tool, userMessage, userId } = body

    console.log('=== VALIDATING PARAMETERS ===')
    console.log('tool:', tool)
    console.log('userMessage:', userMessage)
    console.log('userId:', userId)

    if (!tool || !userMessage || !userId) {
      console.log('Missing required parameters')
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (tool !== 'chatWithTools') {
      console.log('Invalid tool specified:', tool)
      return new Response(JSON.stringify({ error: 'Invalid tool specified' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('=== ENVIRONMENT CHECK ===')
    console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY)
    console.log('SUPABASE_URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('SUPABASE_SERVICE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

    console.log('=== CREATING SIMPLE RESPONSE ===')
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Debug endpoint working - received: ' + userMessage,
      environment: {
        hasOpenAI: !!process.env.OPENAI_API_KEY,
        hasSupabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('=== HANDLER ERROR ===')
    console.error('Error:', error)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
