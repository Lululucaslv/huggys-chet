import { useState, useEffect } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Button } from './ui/button'
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
    <div className="relative min-h-screen bg-slate-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-80 w-80 rounded-full bg-cyan-500/40 blur-3xl" />
        <div className="absolute top-1/4 -right-20 h-96 w-96 rounded-full bg-purple-500/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-blue-500/20 blur-3xl" />
      </div>

      <div className="relative z-10 space-y-6 p-6">
        <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-cyan-200">
                {t('booking_available_times')}
              </h2>
            </div>
            <p className="text-slate-300 text-sm">
              {t('booking_instructions')}
            </p>
          </div>
          
          <div className="p-6">
            <div className="mb-6">
              <label htmlFor="timezone" className="flex items-center gap-2 text-sm font-medium text-cyan-200 mb-2">
                <Globe className="h-4 w-4" />
                {t('booking_timezone_label')}
              </label>
              <Select value={selectedTimezone} onValueChange={updateTimezone}>
                <SelectTrigger className="w-full bg-slate-700/60 border-slate-600/50 text-slate-100 backdrop-blur-sm">
                  <SelectValue placeholder={t('booking_select_timezone')} />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {US_CANADA_TIMEZONES.map((tz: TimezoneOption) => (
                    <SelectItem key={tz.value} value={tz.value} className="text-slate-100">
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-4 backdrop-blur-sm">
                {error}
              </div>
            )}
            
            {success && (
              <div className="bg-green-500/20 border border-green-500/50 text-green-200 px-4 py-3 rounded-lg mb-4 flex items-center gap-2 backdrop-blur-sm">
                <CheckCircle className="h-4 w-4" />
                {success}
              </div>
            )}

            {loading ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full animate-pulse">
                  <Clock className="h-8 w-8 text-white" />
                </div>
                <p className="text-slate-300">{t('booking_loading_slots')}</p>
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-gradient-to-br from-slate-700 to-slate-600 rounded-full">
                  <Clock className="h-8 w-8 text-slate-400" />
                </div>
                <p className="text-slate-300 mb-2">{t('booking_no_slots')}</p>
                <p className="text-sm text-slate-400">{t('booking_try_later_or_contact')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {availableSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="group relative flex items-center justify-between p-4 bg-slate-700/40 backdrop-blur-sm border border-slate-600/50 rounded-xl hover:bg-slate-700/60 hover:border-cyan-500/50 transition-all duration-300"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-100 mb-1">
                          {slot.therapist_name || t('therapist_fallback')}
                        </p>
                        <p className="text-sm text-cyan-300">
                          {formatDateTime(slot.start_time)} - {formatDateTime(slot.end_time)}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {t('booking_duration_minutes', { minutes: getDuration(slot.start_time, slot.end_time) })}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => bookSlot(slot.id)}
                      disabled={bookingLoading === slot.id}
                      className="bg-gradient-to-br from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 disabled:from-slate-600 disabled:to-slate-600 text-white border border-cyan-400/30 transition-all duration-300 hover:scale-105"
                    >
                      {bookingLoading === slot.id ? t('booking_in_progress') : t('book')}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
