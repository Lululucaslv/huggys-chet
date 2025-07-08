export default async function handler(req, res) {
  const { method } = req;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await authenticateUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { message, context } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const aiResponse = await generateBookingAssistance(message, context, user);
    
    return res.status(200).json({
      success: true,
      response: aiResponse,
      suggestions: await getBookingSuggestions(user)
    });

  } catch (error) {
    console.error('AI booking assistant error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function generateBookingAssistance(message, context, user) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const systemPrompt = `你是More Than Hugs心理咨询平台的AI预约助手。你的任务是帮助${user.role === 'CLIENT' ? '来访者' : '心理师'}处理预约相关的问题。

用户信息:
- 姓名: ${user.name}
- 角色: ${user.role === 'CLIENT' ? '来访者' : '心理师'}
- 邮箱: ${user.email}

你可以帮助:
1. 解答预约流程问题
2. 推荐合适的心理师
3. 协助选择预约时间
4. 解释咨询服务内容
5. 处理预约变更请求

请用温暖、专业的语调回应，并提供具体的帮助建议。`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      max_tokens: 500,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function getBookingSuggestions(user) {
  if (user.role === 'CLIENT') {
    return [
      "查看可预约的心理师",
      "了解咨询服务类型",
      "预约最近的可用时间",
      "咨询费用和支付方式"
    ];
  } else {
    return [
      "查看我的预约日程",
      "管理可预约时间",
      "查看来访者信息",
      "设置咨询偏好"
    ];
  }
}

async function authenticateUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return null;
  }

  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const [userId] = decoded.split(':');
    
    const mockUser = {
      id: userId,
      email: userId.includes('therapist') ? 'therapist@morethanhugs.com' : 'client@example.com',
      name: userId.includes('therapist') ? '李心理师' : 'Test User',
      role: userId.includes('therapist') ? 'THERAPIST' : 'CLIENT'
    };

    return mockUser;
  } catch (error) {
    return null;
  }
}
