export const DEMO_USER = {
  id: 'demo-user',
  email: 'demo@huggys.ai',
  display_name: 'Demo User',
  timezone: 'America/New_York',
}

export const DEMO_BOOKINGS = [
  {
    id: 'demo-booking-1',
    therapist_name: 'Dr. Sarah Chen',
    therapist_code: 'DEMO123',
    start_utc: '2025-10-13T18:00:00Z',
    end_utc: '2025-10-13T19:00:00Z',
    duration_mins: 60,
    status: 'confirmed',
    created_at: '2025-10-01T10:00:00Z',
  },
  {
    id: 'demo-booking-2',
    therapist_name: 'Dr. Michael Thompson',
    therapist_code: 'DEMO456',
    start_utc: '2025-10-15T20:00:00Z',
    end_utc: '2025-10-15T21:00:00Z',
    duration_mins: 60,
    status: 'confirmed',
    created_at: '2025-10-02T11:00:00Z',
  },
  {
    id: 'demo-booking-3',
    therapist_name: 'Dr. Emily Rodriguez',
    therapist_code: 'DEMO789',
    start_utc: '2025-10-18T19:00:00Z',
    end_utc: '2025-10-18T20:00:00Z',
    duration_mins: 60,
    status: 'confirmed',
    created_at: '2025-10-05T14:30:00Z',
  },
]

export const DEMO_ASSESSMENTS = [
  {
    id: 'demo-assessment-phq9',
    type: 'PHQ-9',
    name: 'Depression Screening',
    lastScore: 8,
    lastDate: '2025-09-28',
    trend: 'improving' as const,
    sparklineData: [12, 11, 10, 9, 8],
  },
  {
    id: 'demo-assessment-gad7',
    type: 'GAD-7',
    name: 'Anxiety Screening',
    lastScore: 6,
    lastDate: '2025-09-28',
    trend: 'stable' as const,
    sparklineData: [7, 6, 7, 6, 6],
  },
]

export const DEMO_CHAT_PREVIEW = {
  lastMessage: "I've been feeling better lately. The breathing exercises really help!",
  timestamp: '2025-10-05T18:30:00Z',
  unread: false,
}
