export default async function handler(req, res) {
  const { method } = req;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  const user = await authenticateUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    switch (method) {
      case 'POST':
        return await createBooking(req, res, user);
      case 'GET':
        return await getBookings(req, res, user);
      case 'PUT':
        return await updateBooking(req, res, user);
      case 'DELETE':
        return await cancelBooking(req, res, user);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Method ${method} Not Allowed` });
    }
  } catch (error) {
    console.error('Booking API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function createBooking(req, res, user) {
  const { therapistId, appointmentDate, serviceType = "心理咨询", duration = 60 } = req.body;

  if (!therapistId || !appointmentDate) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (user.role !== 'CLIENT') {
    return res.status(403).json({ error: 'Only clients can create bookings' });
  }

  const booking = {
    id: `booking_${Date.now()}`,
    clientId: user.id,
    clientName: user.name,
    clientEmail: user.email,
    therapistId,
    appointmentDate: new Date(appointmentDate),
    serviceType,
    duration,
    status: "CONFIRMED",
    createdDate: new Date(),
    notes: ""
  };

  return res.status(201).json({
    success: true,
    bookingId: booking.id,
    booking
  });
}

async function getBookings(req, res, user) {
  const { status = 'CONFIRMED' } = req.query;

  const mockBookings = [
    {
      id: 'booking_1',
      clientId: 'client_1',
      clientName: 'Test Client',
      clientEmail: 'client@example.com',
      therapistId: 'therapist_1',
      appointmentDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      serviceType: '心理咨询',
      status: 'CONFIRMED'
    }
  ];

  let filteredBookings = mockBookings;

  if (user.role === 'THERAPIST') {
    filteredBookings = filteredBookings.filter(b => b.therapistId === user.id);
  } else if (user.role === 'CLIENT') {
    filteredBookings = filteredBookings.filter(b => b.clientId === user.id);
  }

  filteredBookings = filteredBookings.filter(b => b.status === status);

  return res.status(200).json({
    success: true,
    bookings: filteredBookings
  });
}

async function updateBooking(req, res, user) {
  const { bookingId, status, notes } = req.body;

  if (!bookingId) {
    return res.status(400).json({ error: 'Missing booking ID' });
  }

  if (user.role !== 'THERAPIST' && user.role !== 'CLIENT') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  return res.status(200).json({
    success: true,
    message: 'Booking updated successfully'
  });
}

async function cancelBooking(req, res, user) {
  const { bookingId } = req.body;

  if (!bookingId) {
    return res.status(400).json({ error: 'Missing booking ID' });
  }

  return res.status(200).json({
    success: true,
    message: 'Booking cancelled successfully'
  });
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
