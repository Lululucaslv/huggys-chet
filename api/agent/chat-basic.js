export default function handler(req, res) {
  console.log('🔥 BASIC TEST - Handler called')
  
  res.status(200).json({ 
    message: "Basic endpoint working",
    timestamp: Date.now()
  })
}
