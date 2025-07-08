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
        return await handleAuth(req, res);
      case 'GET':
        return await getCurrentUser(req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${method} Not Allowed` });
    }
  } catch (error) {
    console.error('Auth API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleAuth(req, res) {
  const { action, email, password, name, role = 'CLIENT' } = req.body;

  if (!action || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (action === 'register') {
    if (!password || !name) {
      return res.status(400).json({ error: 'Missing required fields for registration' });
    }

    const user = {
      id: `user_${Date.now()}`,
      email,
      name,
      role,
      createdDate: new Date(),
      isActive: true
    };

    return res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token: generateSimpleToken(user.id)
    });
  }

  if (action === 'login') {
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    const mockUser = {
      id: email === 'therapist@morethanhugs.com' ? 'therapist_1' : `client_${Date.now()}`,
      email,
      name: email === 'therapist@morethanhugs.com' ? '李心理师' : 'Test User',
      role: email === 'therapist@morethanhugs.com' ? 'THERAPIST' : 'CLIENT'
    };

    return res.status(200).json({
      success: true,
      user: mockUser,
      token: generateSimpleToken(mockUser.id)
    });
  }

  return res.status(400).json({ error: 'Invalid action' });
}

async function getCurrentUser(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const userId = parseSimpleToken(token);
  
  if (!userId) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const mockUser = {
    id: userId,
    email: userId.includes('therapist') ? 'therapist@morethanhugs.com' : 'client@example.com',
    name: userId.includes('therapist') ? '李心理师' : 'Test User',
    role: userId.includes('therapist') ? 'THERAPIST' : 'CLIENT'
  };

  return res.status(200).json({
    success: true,
    user: mockUser
  });
}

function generateSimpleToken(userId) {
  return Buffer.from(`${userId}:${Date.now()}`).toString('base64');
}

function parseSimpleToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const [userId] = decoded.split(':');
    return userId;
  } catch (error) {
    return null;
  }
}
