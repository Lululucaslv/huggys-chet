const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://huggy-fullscreen-chat.vercel.app/api'
  : '/api';

export const sendMessage = async (messages, isVision = false) => {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      stream: true,
      isVision
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response;
};

export const createBooking = async (bookingData) => {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${API_BASE_URL}/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(bookingData),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};

export const getBookings = async (params = {}) => {
  const token = localStorage.getItem('auth_token');
  const queryString = new URLSearchParams(params).toString();
  const response = await fetch(`${API_BASE_URL}/bookings?${queryString}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};

export const validateTherapistCode = async (code) => {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${API_BASE_URL}/therapists/validate?code=${code}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};

export const getTherapists = async () => {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${API_BASE_URL}/therapists`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};

export const getSummary = async (bookingId) => {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${API_BASE_URL}/summary-generator?bookingId=${bookingId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};

export const logChatMessage = async (message, sender, userId) => {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${API_BASE_URL}/chat-logger`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      message,
      sender,
      userId
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};

export const getBookingAssistance = async (message, context = {}) => {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${API_BASE_URL}/ai-booking-assistant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      message,
      context
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};
