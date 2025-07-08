export default async function handler(req, res) {
  const { method } = req;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (method) {
      case 'POST':
        return await logChatMessage(req, res);
      case 'GET':
        return await getChatHistory(req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${method} Not Allowed` });
    }
  } catch (error) {
    console.error('Chat logger API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function logChatMessage(req, res) {
  const { message, sender, userId, sessionId } = req.body;

  if (!message || !sender) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const chatLog = {
    id: `log_${Date.now()}`,
    userId: userId || 'anonymous',
    timestamp: new Date(),
    message,
    sender, // "USER" or "AI"
    sessionId: sessionId || null
  };

  console.log('Chat log saved:', chatLog);

  return res.status(201).json({
    success: true,
    logId: chatLog.id
  });
}

async function getChatHistory(req, res) {
  const { userId, limit = 50 } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'Missing user ID' });
  }

  const mockHistory = [
    {
      id: 'log_1',
      userId,
      timestamp: new Date(Date.now() - 60000),
      message: '我最近感到很焦虑',
      sender: 'USER'
    },
    {
      id: 'log_2',
      userId,
      timestamp: new Date(),
      message: '我理解你的感受，焦虑是很常见的情绪反应。能告诉我更多关于让你感到焦虑的具体情况吗？',
      sender: 'AI'
    }
  ];

  return res.status(200).json({
    success: true,
    history: mockHistory.slice(0, parseInt(limit))
  });
}

export async function getUserProfileFromHistory(userId) {
  const profile = {
    firstVisit: new Date(),
    totalMessages: 0,
    personality: '新用户',
    preferences: []
  };

  if (userId !== 'anonymous') {
    profile.totalMessages = 5;
    profile.personality = '认识的朋友';
    profile.preferences = ['焦虑支持'];
  }

  return profile;
}
