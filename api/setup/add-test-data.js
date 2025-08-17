import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  console.log('Add test data API called with method:', req.method)
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables:', {
      supabaseUrl: !supabaseUrl,
      supabaseServiceKey: !supabaseServiceKey
    })
    return res.status(500).json({ error: 'Server configuration error' })
  }

  console.log('Creating Supabase client...')
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    console.log('Adding test therapist profile...')
    
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        id: '550e8400-e29b-41d4-a716-446655440000',
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
      return res.status(500).json({ error: 'Failed to create test therapist profile' })
    }

    console.log('Profile created:', profileData)

    console.log('Adding availability slots...')
    
    const today = new Date()
    const availabilitySlots = []
    
    for (let i = 1; i <= 14; i++) {
      const futureDate = new Date(today)
      futureDate.setDate(today.getDate() + i)
      const futureDateStr = futureDate.toISOString().split('T')[0]
      
      const timeSlots = [
        { start: '09:00:00', end: '10:00:00' },
        { start: '10:00:00', end: '11:00:00' },
        { start: '14:00:00', end: '15:00:00' },
        { start: '15:00:00', end: '16:00:00' },
        { start: '16:00:00', end: '17:00:00' }
      ]
      
      timeSlots.forEach(slot => {
        availabilitySlots.push({
          therapist_id: '550e8400-e29b-41d4-a716-446655440000',
          start_time: `${futureDateStr}T${slot.start}Z`,
          end_time: `${futureDateStr}T${slot.end}Z`,
          is_booked: false
        })
      })
    }
    
    const { data: availabilityData, error: availabilityError } = await supabase
      .from('availability')
      .upsert(availabilitySlots)
      .select()

    if (availabilityError) {
      console.error('Availability error:', availabilityError)
      return res.status(500).json({ error: 'Failed to create test availability slots' })
    }

    console.log('Availability created:', availabilityData)
    return res.status(200).json({ success: true, message: 'Test data added successfully!' })

  } catch (error) {
    console.error('Error adding test data:', error)
    return res.status(500).json({ error: 'Internal server error', details: error.message })
  }
}
