export default async function handler(req, res) {
  console.log('🔥 BASIC TEST - Handler called')
  
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  
  try {
    res.status(200).json({ 
      message: "Basic endpoint working",
      timestamp: Date.now(),
      method: req.method
    })
  } catch (error) {
    console.error('🔥 BASIC TEST - Error:', error)
    res.status(500).json({ error: error.message })
  }
}
