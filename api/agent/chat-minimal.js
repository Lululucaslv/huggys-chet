export const runtime = 'nodejs'

export default async function handler(req) {
  console.log('🔥 MINIMAL TEST - Handler entry point')
  
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await req.json()
    console.log('🔥 MINIMAL TEST - Request received:', body.userMessage?.substring(0, 50))
    
    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()
    
    ;(async () => {
      try {
        const message = "我正在查询Megan Chang咨询师的可用时间段...\n\n根据系统记录，Megan Chang咨询师明天有以下可预约时间：\n\n1. 上午9:00-10:00\n2. 下午2:00-3:00\n3. 下午4:00-5:00\n\n请告诉我您希望预约哪个时间段？"
        
        for (let i = 0; i < message.length; i++) {
          await writer.write(encoder.encode(message[i]))
          await new Promise(resolve => setTimeout(resolve, 20)) // Small delay for streaming effect
        }
        
        await writer.close()
      } catch (streamError) {
        console.error('🔥 MINIMAL TEST - Stream error:', streamError)
        await writer.write(encoder.encode(`\n\nError: ${streamError.message}\n\n`))
        await writer.close()
      }
    })()
    
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked'
      }
    })

  } catch (error) {
    console.error('🔥 MINIMAL TEST - Handler error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
