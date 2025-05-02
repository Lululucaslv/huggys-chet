// api/chat.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
  
    try {
      const { message } = req.body;
  
      // 示例：模拟返回 AI 回复，可改为调用 OpenAI
      const reply = `AI 回复你说：“${message}”`;
  
      return res.status(200).json({ reply });
    } catch (err) {
      console.error("Chat error:", err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
  