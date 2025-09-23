export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { createClient } = await import('@supabase/supabase-js')
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Missing Supabase configuration' })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        id: 'test-therapist-megan-chang',
        email: 'megan.chang@example.com',
        full_name: 'Megan Chang',
        role: 'THERAPIST',
        total_messages: 0,
        personality_type: 'professional',
        preferences: ['cognitive-behavioral', 'mindfulness'],
        communication_style: 'supportive'
      })
      .select()

    if (profileError) {
      console.error('Profile error:', profileError)
      return res.status(500).json({ error: 'Failed to create therapist profile', details: profileError })
    }

    const { data: availabilityData, error: availabilityError } = await supabase
      .from('availability')
      .upsert([
        {
          therapist_id: 'test-therapist-megan-chang',
          start_time: '2025-08-19T14:00:00Z',
          end_time: '2025-08-19T15:00:00Z',
          is_booked: false
        },
        {
          therapist_id: 'test-therapist-megan-chang',
          start_time: '2025-08-19T15:00:00Z',
          end_time: '2025-08-19T16:00:00Z',
          is_booked: false
        },
        {
          therapist_id: 'test-therapist-megan-chang',
          start_time: '2025-08-20T10:00:00Z',
          end_time: '2025-08-20T11:00:00Z',
          is_booked: false
        }
      ])
      .select()

    if (availabilityError) {
      console.error('Availability error:', availabilityError)
      return res.status(500).json({ error: 'Failed to create availability', details: availabilityError })
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Test therapist Megan Chang added successfully',
      profile: profileData,
      availability: availabilityData
    })

  } catch (error) {
    console.error('Error adding test therapist:', error)
    return res.status(500).json({ error: 'Internal server error', details: error.message })
  }
}
