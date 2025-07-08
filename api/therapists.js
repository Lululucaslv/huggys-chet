export default async function handler(req, res) {
  const { method } = req;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (method) {
      case 'GET':
        return await getTherapists(req, res);
      case 'POST':
        return await createTherapist(req, res);
      case 'PUT':
        return await updateTherapist(req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT']);
        return res.status(405).json({ error: `Method ${method} Not Allowed` });
    }
  } catch (error) {
    console.error('Therapists API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getTherapists(req, res) {
  const { status = 'ACTIVE' } = req.query;

  const mockTherapists = [
    {
      id: 'therapist_1',
      name: '李心理师',
      email: 'li@morethanhugs.com',
      specialization: '焦虑症治疗, 认知行为疗法',
      bio: '拥有10年心理咨询经验，专注于焦虑症和抑郁症的治疗。',
      status: 'ACTIVE',
      userId: 'user_therapist_1'
    },
    {
      id: 'therapist_2',
      name: '王心理师',
      email: 'wang@morethanhugs.com',
      specialization: '家庭治疗, 情感咨询',
      bio: '专业家庭治疗师，擅长处理夫妻关系和亲子关系问题。',
      status: 'ACTIVE',
      userId: 'user_therapist_2'
    }
  ];

  const filteredTherapists = mockTherapists.filter(t => t.status === status);

  return res.status(200).json({
    success: true,
    therapists: filteredTherapists
  });
}

async function createTherapist(req, res) {
  const { name, email, specialization, bio, userId } = req.body;

  if (!name || !email || !userId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const therapist = {
    id: `therapist_${Date.now()}`,
    name,
    email,
    specialization: specialization || '',
    bio: bio || '',
    status: 'ACTIVE',
    userId,
    createdDate: new Date()
  };

  console.log('Therapist created:', therapist);

  return res.status(201).json({
    success: true,
    therapist
  });
}

async function updateTherapist(req, res) {
  const { therapistId, ...updates } = req.body;

  if (!therapistId) {
    return res.status(400).json({ error: 'Missing therapist ID' });
  }

  
  return res.status(200).json({
    success: true,
    message: 'Therapist updated successfully'
  });
}
