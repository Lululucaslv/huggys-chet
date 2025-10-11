import { useAuthGate } from '../contexts/AuthGateContext'
import { DEMO_BOOKINGS, DEMO_ASSESSMENTS, DEMO_CHAT_PREVIEW } from '../lib/demoData'

export function useBookings() {
  const { isDemoMode } = useAuthGate()
  
  return {
    bookings: isDemoMode ? DEMO_BOOKINGS : [],
    isLoading: false,
    refetch: () => {},
  }
}

export function useAssessments() {
  const { isDemoMode } = useAuthGate()
  
  return {
    assessments: isDemoMode ? DEMO_ASSESSMENTS : [],
    isLoading: false,
  }
}

export function useChatPreview() {
  const { isDemoMode } = useAuthGate()
  
  return {
    chatPreview: isDemoMode ? DEMO_CHAT_PREVIEW : null,
    isLoading: false,
  }
}
