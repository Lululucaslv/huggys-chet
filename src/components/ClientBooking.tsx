import { useState, useEffect } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Calendar, Clock, User, CheckCircle, Globe } from 'lucide-react'
import { US_CANADA_TIMEZONES, formatDisplayDateTime, TimezoneOption } from '../lib/timezone'
import { useTranslation } from 'react-i18next'

interface AvailabilitySlot {
  id: number
  therapist_id: string
  start_time: string
  end_time: string
  is_booked: boolean
  created_at: string
  updated_at: string
  therapist_name?: string
}

interface ClientBookingProps {
  session: Session
}

export default function ClientBooking({ session }: ClientBookingProps) {
  const { t, i18n } = useTranslation()
  const [availableSlots, setAvailableSlots] = useState<AvailabilitySlot[]>([])
  const [loading, setLoading] = useState(false)
  const [bookingLoading, setBookingLoading] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [userProfile, setUserProfile] = useState<any>(null)
  const [selectedTimezone, setSelectedTimezone] = useState('America/New_York')

  useEffect(() => {
    fetchUserProfile()
  }, [session])

  useEffect(() => {
    if (userProfile) {
      fetchAvailableSlots()
    }
  }, [userProfile])

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (error && error.code === 'PGRST116') {
        console.log('User profile not found, creating new profile...')
        await createUserProfile()
        return
      }

      if (error) {
        console.error('Error fetching user profile:', error)
        return
      }

      setUserProfile(data)
      setSelectedTimezone(data.timezone || 'America/New_York')
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const createUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .insert([
          {
            user_id: session.user.id,
            interest: 'therapy',
            language: (i18n.resolvedLanguage === 'zh' ? 'zh-CN' : i18n.resolvedLanguage) || 'en',
            life_status: 'client',
            timezone: 'America/New_York'
          }
        ])
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          console.log('User profile already exists, fetching existing profile...')
          await fetchUserProfile()
          return
        }
        console.error('Error creating user profile:', error)
        setError(t('err_create_profile'))
        return
      }

      console.log('User profile created successfully:', data)
      setUserProfile(data)
      setSelectedTimezone(data.timezone || 'America/New_York')
    } catch (err) {
      console.error('Error creating user profile:', err)
      setError(t('err_create_profile'))
    }
  }

  const fetchAvailableSlots = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('availability')
        .select(`
          *,
          user_profiles!availability_therapist_id_fkey (
            id,
            user_id
          )
        `)
        .eq('is_booked', false)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })

      if (error) {
        console.error('Error fetching available slots:', error)
        setError(t('err_fetch_slots'))
        return
      }

      const slotsWithNames = await Promise.all(
        (data || []).map(async (slot) => {
          try {
            const therapistUserId = slot.user_profiles.user_id
            const { data: therapistRow } = await supabase
              .from('therapists')
              .select('name')
              .eq('user_id', therapistUserId)
              .maybeSingle()
            return {
              ...slot,
              therapist_name: therapistRow?.name || ''
            }
          } catch (err) {
            return {
              ...slot,
              therapist_name: ''
            }
          }
        })
      )

      setAvailableSlots(slotsWithNames)
    } catch (err) {
      console.error('Error:', err)
      setError(t('err_fetch_slots'))
    } finally {
      setLoading(false)
    }
  }

  const bookSlot = async (slotId: number) => {
    if (!userProfile) {
      setError(t('err_user_not_loaded'))
      return
    }

    setBookingLoading(slotId)
    setError('')
    setSuccess('')

    try {
      const { data, error } = await supabase.rpc('create_booking', {
        availability_id_to_book: slotId,
        client_user_id_to_book: session.user.id
      })

      if (error) {
        console.error('Error booking slot:', error)
        setError(t('err_booking_failed'))
        return
      }

      if (data && !data.success) {
        setError(data.error || t('err_booking_generic'))
        return
      }

      setSuccess(t('booking_success'))
      fetchAvailableSlots()
    } catch (err) {
      console.error('Error:', err)
      setError(t('err_booking_failed'))
    } finally {
      setBookingLoading(null)
    }
  }

  const formatDateTime = (dateTimeString: string) => {
    return formatDisplayDateTime(dateTimeString, selectedTimezone)
  }

  const updateTimezone = async (newTimezone: string) => {
    if (!userProfile) return
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ timezone: newTimezone })
        .eq('id', userProfile.id)

      if (error) {
        console.error('Error updating timezone:', error)
        setError(t('err_update_timezone'))
        return
      }

      setSelectedTimezone(newTimezone)
      setUserProfile({ ...userProfile, timezone: newTimezone })
    } catch (err) {
      console.error('Error updating timezone:', err)
      setError(t('err_update_timezone'))
    }
  }

  const getDuration = (startTime: string, endTime: string) => {
    const start = new Date(startTime)
    const end = new Date(endTime)
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60))
  }

  if (!userProfile) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <p className="text-gray-500">{t('loading_user')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('booking_available_times')}
          </CardTitle>
          <CardDescription>
            {t('booking_instructions')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">
              <Globe className="inline h-4 w-4 mr-1" />
              {t('booking_timezone_label')}
            </label>
            <Select value={selectedTimezone} onValueChange={updateTimezone}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('booking_select_timezone')} />
              </SelectTrigger>
              <SelectContent>
                {US_CANADA_TIMEZONES.map((tz: TimezoneOption) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              {success}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">{t('booking_loading_slots')}</p>
            </div>
          ) : availableSlots.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">{t('booking_no_slots')}</p>
              <p className="text-sm text-gray-400 mt-1">{t('booking_try_later_or_contact')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {slot.therapist_name || t('therapist_fallback')}
                      </p>
                      <p className="text-sm text-gray-600">
                        {formatDateTime(slot.start_time)} - {formatDateTime(slot.end_time)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t('booking_duration_minutes', { minutes: getDuration(slot.start_time, slot.end_time) })}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => bookSlot(slot.id)}
                    disabled={bookingLoading === slot.id}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {bookingLoading === slot.id ? t('booking_in_progress') : t('book')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
