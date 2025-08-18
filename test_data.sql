INSERT INTO user_profiles (id, email, full_name, role, total_messages, personality_type, preferences, communication_style, created_at, updated_at)
VALUES (
  'test-therapist-id-123',
  'megan.chang@example.com',
  'Megan Chang',
  'THERAPIST',
  0,
  'professional',
  ARRAY['cognitive-behavioral', 'mindfulness'],
  'supportive',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO availability (therapist_id, start_time, end_time, is_booked)
VALUES 
  ('test-therapist-id-123', '2025-08-18 09:00:00+00', '2025-08-18 10:00:00+00', false),
  ('test-therapist-id-123', '2025-08-18 14:00:00+00', '2025-08-18 15:00:00+00', false),
  ('test-therapist-id-123', '2025-08-18 15:00:00+00', '2025-08-18 16:00:00+00', false),
  ('test-therapist-id-123', '2025-08-19 09:00:00+00', '2025-08-19 10:00:00+00', false),
  ('test-therapist-id-123', '2025-08-19 14:00:00+00', '2025-08-19 15:00:00+00', false),
  ('test-therapist-id-123', '2025-08-19 15:00:00+00', '2025-08-19 16:00:00+00', false),
  ('test-therapist-id-123', '2025-08-20 10:00:00+00', '2025-08-20 11:00:00+00', false),
  ('test-therapist-id-123', '2025-08-20 14:00:00+00', '2025-08-20 15:00:00+00', false),
  ('test-therapist-id-123', '2025-08-21 09:00:00+00', '2025-08-21 10:00:00+00', false),
  ('test-therapist-id-123', '2025-08-21 14:00:00+00', '2025-08-21 15:00:00+00', false)
ON CONFLICT DO NOTHING;
