export default async function handler(req, res) {
  console.log('🔥 SIMPLE TEST - Handler entry point')
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = req.body
    console.log('🔥 SIMPLE TEST - Request received:', body.userMessage?.substring(0, 50))
    
    const response = {
      success: true,
      message: "我正在查询Megan Chang咨询师的可用时间段...\n\n根据系统记录，Megan Chang咨询师明天有以下可预约时间：\n\n1. 上午9:00-10:00\n2. 下午2:00-3:00\n3. 下午4:00-5:00\n\n请告诉我您希望预约哪个时间段？",
      timestamp: new Date().toISOString()
    }
    
    console.log('🔥 SIMPLE TEST - Sending response')
    return res.status(200).json(response)

  } catch (error) {
    console.error('🔥 SIMPLE TEST - Handler error:', error)
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    })
  }
}
