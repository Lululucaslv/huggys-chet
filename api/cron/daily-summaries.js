export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('Daily summary generation started...');

  try {
    const result = await generateDailySummaries();
    
    console.log('Daily summary generation completed:', result);
    
    return res.status(200).json({
      success: true,
      message: 'Daily summaries generated successfully',
      ...result
    });

  } catch (error) {
    console.error('Daily summary generation failed:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

async function generateDailySummaries() {
  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  try {
    const upcomingBookings = await getUpcomingBookingsForSummary();
    
    console.log(`Found ${upcomingBookings.length} upcoming bookings for summary generation`);

    for (const booking of upcomingBookings) {
      try {
        const userId = booking.clientId;
        
        if (!userId) {
          console.log(`No user ID found for booking ${booking.id}, skipping...`);
          continue;
        }
        
        const lastSessionDate = await getLastSessionDate(userId, booking.therapistId);
        
        const result = await generateSessionSummary(userId, booking.id, lastSessionDate);
        
        if (result.success) {
          successCount++;
          console.log(`Successfully generated summary for booking ${booking.id}`);
        } else {
          errorCount++;
          const error = `Failed to generate summary for booking ${booking.id}: ${result.error || result.message}`;
          console.log(error);
          errors.push(error);
        }
        
      } catch (error) {
        errorCount++;
        const errorMsg = `Error processing booking ${booking.id}: ${error.message}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    const executionLog = {
      id: `execution_${Date.now()}`,
      executionDate: new Date(),
      totalBookings: upcomingBookings.length,
      successCount,
      errorCount,
      errors: errors.slice(0, 10), // Limit error details
      status: errorCount === 0 ? 'SUCCESS' : 'PARTIAL_SUCCESS'
    };

    console.log('Execution log:', executionLog);

    return {
      totalBookings: upcomingBookings.length,
      successCount,
      errorCount,
      status: executionLog.status
    };

  } catch (error) {
    console.error("Critical error in daily summary generation:", error);
    throw error;
  }
}

async function getUpcomingBookingsForSummary() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dayAfterTomorrow = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  
  const mockBookings = [
    {
      id: 'booking_1',
      clientId: 'client_1',
      therapistId: 'therapist_1',
      appointmentDate: new Date(now.getTime() + 30 * 60 * 60 * 1000),
      status: 'CONFIRMED'
    }
  ];

  return mockBookings.filter(booking => {
    const appointmentDate = new Date(booking.appointmentDate);
    return appointmentDate >= tomorrow && appointmentDate <= dayAfterTomorrow && booking.status === 'CONFIRMED';
  });
}

async function getLastSessionDate(userId, therapistId) {
  return null; // No previous sessions for now
}

async function generateSessionSummary(userId, bookingId, lastSessionDate) {
  try {
    const response = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/summary-generator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        bookingId,
        lastSessionDate
      })
    });

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
