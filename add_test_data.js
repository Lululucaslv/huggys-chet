import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rdnhvrpkplkgycxrgrta.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkbmh2cnBrcGxrZ3ljeHJncnRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjYxODU0MSwiZXhwIjoyMDU4MTk0NTQxfQ.nZw5nQfzwS2FHQGoaQFYbV2EVc863WkpIYytEctzZqI'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addTestData() {
  try {
    console.log('Adding test therapist profile...')
    
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: 'megan.chang@example.com',
        interest: 'psychology, therapy',
        language: 'English, Chinese',
        life_status: 'Professional therapist - Megan Chang'
      })
      .select()

    if (profileError) {
      console.error('Profile error:', profileError)
      return
    }

    console.log('Profile created:', profileData)

    console.log('Adding availability slots...')
    
    const { data: availabilityData, error: availabilityError } = await supabase
      .from('availability')
      .upsert([
        {
          therapist_id: '550e8400-e29b-41d4-a716-446655440000',
          start_time: '2025-08-18T09:00:00Z',
          end_time: '2025-08-18T10:00:00Z',
          is_booked: false
        },
        {
          therapist_id: '550e8400-e29b-41d4-a716-446655440000',
          start_time: '2025-08-18T14:00:00Z',
          end_time: '2025-08-18T15:00:00Z',
          is_booked: false
        },
        {
          therapist_id: '550e8400-e29b-41d4-a716-446655440000',
          start_time: '2025-08-18T15:00:00Z',
          end_time: '2025-08-18T16:00:00Z',
          is_booked: false
        },
        {
          therapist_id: '550e8400-e29b-41d4-a716-446655440000',
          start_time: '2025-08-19T09:00:00Z',
          end_time: '2025-08-19T10:00:00Z',
          is_booked: false
        },
        {
          therapist_id: '550e8400-e29b-41d4-a716-446655440000',
          start_time: '2025-08-19T14:00:00Z',
          end_time: '2025-08-19T15:00:00Z',
          is_booked: false
        },
        {
          therapist_id: '550e8400-e29b-41d4-a716-446655440000',
          start_time: '2025-08-19T15:00:00Z',
          end_time: '2025-08-19T16:00:00Z',
          is_booked: false
        },
        {
          therapist_id: '550e8400-e29b-41d4-a716-446655440000',
          start_time: '2025-08-20T10:00:00Z',
          end_time: '2025-08-20T11:00:00Z',
          is_booked: false
        },
        {
          therapist_id: '550e8400-e29b-41d4-a716-446655440000',
          start_time: '2025-08-20T14:00:00Z',
          end_time: '2025-08-20T15:00:00Z',
          is_booked: false
        }
      ])
      .select()

    if (availabilityError) {
      console.error('Availability error:', availabilityError)
      return
    }

    console.log('Availability created:', availabilityData)
    console.log('Test data added successfully!')

  } catch (error) {
    console.error('Error adding test data:', error)
  }
}

addTestData()
