import { useState, useEffect } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Calendar, Clock, Plus, Trash2, Globe, Users, User, Loader2 } from 'lucide-react'
import { US_CANADA_TIMEZONES, formatDisplayDateTime, convertLocalToUTC, TimezoneOption } from '../lib/timezone'
import AISummaryModal from './AISummaryModal'
import { useTranslation } from 'react-i18next'

interface AvailabilitySlot {
  id: number
  therapist_id: string
  start_time: string
  end_time: string
  is_booked: boolean
  created_at: string
  updated_at: string
}

interface Booking {
  id: string
  client_user_id: string
  session_date: string
  duration_minutes: number
  status: string
  client_name?: string
}

interface TherapistScheduleProps {
  session: Session
  refreshKey?: number
}

export default function TherapistSchedule({ session, refreshKey }: TherapistScheduleProps) {
  const { t, i18n } = useTranslation()
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([])
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userProfile, setUserProfile] = useState<any>(null)
  const [selectedTimezone, setSelectedTimezone] = useState('America/New_York')
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([])
  const [bookingsLoading, setBookingsLoading] = useState(false)

  useEffect(() => {
    fetchUserProfile()
  }, [session])

  useEffect(() => {
    if (userProfile) {
      fetchAvailabilitySlots()
      fetchUpcomingBookings()
    }
  }, [userProfile])

  useEffect(() => {
    if (userProfile) {
      fetchAvailabilitySlots()
    }
  }, [refreshKey])

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
            life_status: 'therapist',
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

  const fetchAvailabilitySlots = async () => {
    if (!userProfile) return

    try {
      const { data, error } = await supabase
        .from('availability')
        .select('*')
        .eq('therapist_id', userProfile.id)
        .eq('is_booked', false)
        .order('start_time', { ascending: true })

      if (error) {
        console.error('Error fetching availability slots:', error)
        return
      }

      setAvailabilitySlots(data || [])
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const fetchUpcomingBookings = async () => {
    if (!userProfile) return

    setBookingsLoading(true)
    try {
      let { data: therapistData, error: therapistError } = await supabase
        .from('therapists')
        .select('id')
        .eq('user_id', session.user.id)
        .single()

      if (therapistError || !therapistData) {
        console.log('No therapist record found, creating one...')
        const { data: newTherapistData, error: createError } = await supabase
          .from('therapists')
          .insert([
            {
              user_id: session.user.id,
              name: userProfile.email?.split('@')[0] || 'Therapist',
              specialization: 'General Therapy',
              bio: 'Professional therapist',
              hourly_rate: 100.00
            }
          ])
          .select()
          .single()

        if (createError) {
          console.error('Error creating therapist record:', createError)
          setUpcomingBookings([])
          return
        }

        therapistData = newTherapistData
      }

      if (!therapistData) {
        console.error('Failed to get or create therapist record')
        setUpcomingBookings([])
        return
      }

      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('therapist_id', therapistData.id)
        .gte('session_date', new Date().toISOString())
        .in('status', ['confirmed', 'pending'])
        .order('session_date', { ascending: true })

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError)
        return
      }

      const bookingsWithNames = await Promise.all(
        (bookingsData || []).map(async (booking) => {
          try {
            const { data: userData } = await supabase.auth.admin.getUserById(booking.client_user_id)
            return {
              ...booking,
              client_name: userData?.user?.email?.split('@')[0] || t('client_fallback')
            }
          } catch (err) {
            return {
              ...booking,
              client_name: t('client_fallback')
            }
          }
        })
      )

      setUpcomingBookings(bookingsWithNames)
    } catch (err) {
      console.error('Error fetching bookings:', err)
    } finally {
      setBookingsLoading(false)
    }
  }

  const addAvailabilitySlot = async () => {
    if (!startTime || !endTime || !userProfile) {
      setError(t('sched_fill_start_end'))
      return
    }

    if (new Date(startTime) >= new Date(endTime)) {
      setError(t('sched_end_after_start'))
      return
    }

    if (new Date(startTime) <= new Date()) {
      setError(t('sched_future_time'))
      return
    }

    setLoading(true)
    setError('')

    try {
      const utcStartTime = convertLocalToUTC(startTime, selectedTimezone)
      const utcEndTime = convertLocalToUTC(endTime, selectedTimezone)
      
      const { error } = await supabase
        .from('availability')
        .insert([
          {
            therapist_id: userProfile.id,
            start_time: utcStartTime,
            end_time: utcEndTime,
            is_booked: false
          }
        ])
        .select()

      if (error) {
        console.error('Error adding availability slot:', error)
        setError(t('sched_add_slot_failed'))
        return
      }

      setStartTime('')
      setEndTime('')
      fetchAvailabilitySlots()
    } catch (err) {
      console.error('Error:', err)
      setError(t('sched_add_slot_failed'))
    } finally {
      setLoading(false)
    }
  }

  const deleteAvailabilitySlot = async (slotId: number) => {
    setLoading(true)

    try {
      const { error } = await supabase
        .from('availability')
        .delete()
        .eq('id', slotId)

      if (error) {
        console.error('Error deleting availability slot:', error)
        setError(t('sched_delete_slot_failed'))
        return
      }

      fetchAvailabilitySlots()
    } catch (err) {
      console.error('Error:', err)
      setError(t('sched_delete_slot_failed'))
    } finally {
      setLoading(false)
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
            <Users className="h-5 w-5" />
            {t('sched_upcoming_bookings')}
          </CardTitle>
          <CardDescription>
            {t('sched_upcoming_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bookingsLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">{t('sched_loading')}</p>
            </div>
          ) : upcomingBookings.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">{t('sched_no_bookings')}</p>
              <p className="text-sm text-gray-400 mt-1">{t('sched_no_bookings_hint')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {booking.client_name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {formatDateTime(booking.session_date)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t('duration')}: {booking.duration_minutes} {t('minutes')} • {t('status')}: {booking.status === 'confirmed' ? t('status_confirmed') : t('status_pending')}
                      </p>
                    </div>
                  </div>
                  <AISummaryModal
                    clientUserId={booking.client_user_id}
                    clientName={booking.client_name || t('client_fallback')}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {t('sched_add_availability')}
          </CardTitle>
          <CardDescription>
            {t('sched_add_availability_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
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
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="start-time" className="block text-sm font-medium text-gray-700 mb-1">
                {t('sched_start_time_label')}
              </label>
              <Input
                id="start-time"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label htmlFor="end-time" className="block text-sm font-medium text-gray-700 mb-1">
                {t('sched_end_time_label')}
              </label>
              <Input
                id="end-time"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
          
          <Button 
            onClick={addAvailabilitySlot} 
            disabled={loading || !startTime || !endTime}
            className="w-full md:w-auto"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('sched_adding')}
              </span>
            ) : t('sched_add_time_slot')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('sched_my_availability')}
          </CardTitle>
          <CardDescription>
            {t('sched_my_availability_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {availabilitySlots.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">{t('sched_no_availability_slots')}</p>
              <p className="text-sm text-gray-400 mt-1">{t('sched_add_first_slot_hint')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availabilitySlots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {formatDateTime(slot.start_time)} - {formatDateTime(slot.end_time)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {t('booking_duration_minutes', { minutes: Math.round((new Date(slot.end_time).getTime() - new Date(slot.start_time).getTime()) / (1000 * 60)) })}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteAvailabilitySlot(slot.id)}
                    disabled={loading}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
