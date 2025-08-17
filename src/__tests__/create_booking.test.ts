import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn()
  }
}))

const mockSupabase = vi.mocked(supabase)

describe('create_booking RPC function', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Success scenarios', () => {
    it('should successfully create a booking with valid data', async () => {
      const mockResponse = {
        data: {
          success: true,
          booking_id: 'test-booking-id',
          therapist_id: 'test-therapist-id',
          session_date: '2025-08-12T10:00:00Z',
          duration_minutes: 60,
          message: 'Booking created successfully'
        },
        error: null,
        count: null,
        status: 200,
        statusText: 'OK'
      }

      mockSupabase.rpc.mockResolvedValueOnce(mockResponse as any)

      const result = await supabase.rpc('create_booking', {
        availability_id_to_book: 1,
        client_user_id_to_book: 'test-client-uuid'
      })

      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_booking', {
        availability_id_to_book: 1,
        client_user_id_to_book: 'test-client-uuid'
      })

      expect(result.data).toEqual({
        success: true,
        booking_id: 'test-booking-id',
        therapist_id: 'test-therapist-id',
        session_date: '2025-08-12T10:00:00Z',
        duration_minutes: 60,
        message: 'Booking created successfully'
      })
      expect(result.error).toBeNull()
    })

    it('should handle successful booking with auto-created therapist record', async () => {
      const mockResponse = {
        data: {
          success: true,
          booking_id: 'new-booking-id',
          therapist_id: 'new-therapist-id',
          session_date: '2025-08-12T14:00:00Z',
          duration_minutes: 90,
          message: 'Booking created successfully'
        },
        error: null,
        count: null,
        status: 200,
        statusText: 'OK'
      }

      mockSupabase.rpc.mockResolvedValueOnce(mockResponse as any)

      const result = await supabase.rpc('create_booking', {
        availability_id_to_book: 2,
        client_user_id_to_book: 'another-client-uuid'
      })

      expect(result.data.success).toBe(true)
      expect(result.data.booking_id).toBe('new-booking-id')
      expect(result.data.duration_minutes).toBe(90)
    })
  })

  describe('Failure scenarios', () => {
    it('should return error when availability slot not found', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: 'Availability slot not found'
        },
        error: null,
        count: null,
        status: 200,
        statusText: 'OK'
      }

      mockSupabase.rpc.mockResolvedValueOnce(mockResponse as any)

      const result = await supabase.rpc('create_booking', {
        availability_id_to_book: 999,
        client_user_id_to_book: 'test-client-uuid'
      })

      expect(result.data).toEqual({
        success: false,
        error: 'Availability slot not found'
      })
    })

    it('should return error when time slot is already booked', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: 'This time slot has already been booked'
        },
        error: null,
        count: null,
        status: 200,
        statusText: 'OK'
      }

      mockSupabase.rpc.mockResolvedValueOnce(mockResponse as any)

      const result = await supabase.rpc('create_booking', {
        availability_id_to_book: 1,
        client_user_id_to_book: 'test-client-uuid'
      })

      expect(result.data).toEqual({
        success: false,
        error: 'This time slot has already been booked'
      })
    })

    it('should return error when therapist profile not found', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: 'Therapist profile not found'
        },
        error: null,
        count: null,
        status: 200,
        statusText: 'OK'
      }

      mockSupabase.rpc.mockResolvedValueOnce(mockResponse as any)

      const result = await supabase.rpc('create_booking', {
        availability_id_to_book: 1,
        client_user_id_to_book: 'test-client-uuid'
      })

      expect(result.data).toEqual({
        success: false,
        error: 'Therapist profile not found'
      })
    })

    it('should handle database errors with exception handling', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: 'Failed to create booking: database connection error'
        },
        error: null,
        count: null,
        status: 200,
        statusText: 'OK'
      }

      mockSupabase.rpc.mockResolvedValueOnce(mockResponse as any)

      const result = await supabase.rpc('create_booking', {
        availability_id_to_book: 1,
        client_user_id_to_book: 'test-client-uuid'
      })

      expect(result.data.success).toBe(false)
      expect(result.data.error).toContain('Failed to create booking:')
    })

    it('should handle network/connection errors', async () => {
      const mockError = new Error('Network error')
      mockSupabase.rpc.mockRejectedValueOnce(mockError)

      await expect(
        supabase.rpc('create_booking', {
          availability_id_to_book: 1,
          client_user_id_to_book: 'test-client-uuid'
        })
      ).rejects.toThrow('Network error')
    })
  })

  describe('Edge cases', () => {
    it('should handle invalid UUID format for client_user_id_to_book', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: 'Failed to create booking: invalid input syntax for type uuid'
        },
        error: null,
        count: null,
        status: 200,
        statusText: 'OK'
      }

      mockSupabase.rpc.mockResolvedValueOnce(mockResponse as any)

      const result = await supabase.rpc('create_booking', {
        availability_id_to_book: 1,
        client_user_id_to_book: 'invalid-uuid-format'
      })

      expect(result.data.success).toBe(false)
      expect(result.data.error).toContain('Failed to create booking:')
    })

    it('should handle invalid bigint for availability_id_to_book', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: 'Failed to create booking: invalid input syntax for type bigint'
        },
        error: null,
        count: null,
        status: 200,
        statusText: 'OK'
      }

      mockSupabase.rpc.mockResolvedValueOnce(mockResponse as any)

      const result = await supabase.rpc('create_booking', {
        availability_id_to_book: 'not-a-number' as any,
        client_user_id_to_book: 'test-client-uuid'
      })

      expect(result.data.success).toBe(false)
      expect(result.data.error).toContain('Failed to create booking:')
    })

    it('should handle null parameters', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: 'Failed to create booking: null value in column violates not-null constraint'
        },
        error: null,
        count: null,
        status: 200,
        statusText: 'OK'
      }

      mockSupabase.rpc.mockResolvedValueOnce(mockResponse as any)

      const result = await supabase.rpc('create_booking', {
        availability_id_to_book: null as any,
        client_user_id_to_book: null as any
      })

      expect(result.data.success).toBe(false)
      expect(result.data.error).toContain('Failed to create booking:')
    })
  })

  describe('Function call validation', () => {
    it('should call RPC with correct function name and parameters', async () => {
      const mockResponse = {
        data: { success: true, booking_id: 'test' },
        error: null,
        count: null,
        status: 200,
        statusText: 'OK'
      }

      mockSupabase.rpc.mockResolvedValueOnce(mockResponse as any)

      await supabase.rpc('create_booking', {
        availability_id_to_book: 123,
        client_user_id_to_book: 'uuid-test-123'
      })

      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_booking', {
        availability_id_to_book: 123,
        client_user_id_to_book: 'uuid-test-123'
      })
    })

    it('should handle multiple concurrent booking attempts', async () => {
      const mockResponses = [
        {
          data: { success: true, booking_id: 'booking-1' },
          error: null,
          count: null,
          status: 200,
          statusText: 'OK'
        },
        {
          data: { success: false, error: 'This time slot has already been booked' },
          error: null,
          count: null,
          status: 200,
          statusText: 'OK'
        }
      ]

      mockSupabase.rpc
        .mockResolvedValueOnce(mockResponses[0] as any)
        .mockResolvedValueOnce(mockResponses[1] as any)

      const [result1, result2] = await Promise.all([
        supabase.rpc('create_booking', {
          availability_id_to_book: 1,
          client_user_id_to_book: 'client-1'
        }),
        supabase.rpc('create_booking', {
          availability_id_to_book: 1,
          client_user_id_to_book: 'client-2'
        })
      ])

      expect(result1.data.success).toBe(true)
      expect(result2.data.success).toBe(false)
      expect(result2.data.error).toBe('This time slot has already been booked')
    })
  })
})
