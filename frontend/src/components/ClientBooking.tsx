import { useState, useEffect } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar, Clock, User, CheckCircle, Globe } from 'lucide-react'
import { US_CANADA_TIMEZONES, formatDisplayDateTime, TimezoneOption } from '../lib/timezone'

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
            language: 'zh-CN',
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
        setError('创建用户档案失败，请重试')
        return
      }

      console.log('User profile created successfully:', data)
      setUserProfile(data)
      setSelectedTimezone(data.timezone || 'America/New_York')
    } catch (err) {
      console.error('Error creating user profile:', err)
      setError('创建用户档案失败，请重试')
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
        setError('获取可预约时间失败')
        return
      }

      const slotsWithNames = await Promise.all(
        (data || []).map(async (slot) => {
          try {
            const { data: userData } = await supabase.auth.admin.getUserById(
              slot.user_profiles.user_id
            )
            
            return {
              ...slot,
              therapist_name: userData?.user?.email?.split('@')[0] || '治疗师'
            }
          } catch (err) {
            return {
              ...slot,
              therapist_name: '治疗师'
            }
          }
        })
      )

      setAvailableSlots(slotsWithNames)
    } catch (err) {
      console.error('Error:', err)
      setError('获取可预约时间失败')
    } finally {
      setLoading(false)
    }
  }

  const bookSlot = async (slotId: number) => {
    if (!userProfile) {
      setError('用户信息未加载完成')
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
        setError('预约失败，请重试')
        return
      }

      if (data && !data.success) {
        setError(data.error || '预约失败')
        return
      }

      setSuccess('预约成功！')
      fetchAvailableSlots() // Refresh the list
    } catch (err) {
      console.error('Error:', err)
      setError('预约失败，请重试')
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
        setError('更新时区失败，请重试')
        return
      }

      setSelectedTimezone(newTimezone)
      setUserProfile({ ...userProfile, timezone: newTimezone })
    } catch (err) {
      console.error('Error updating timezone:', err)
      setError('更新时区失败，请重试')
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
          <p className="text-gray-500">加载用户信息中...</p>
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
            可预约时间
          </CardTitle>
          <CardDescription>
            选择您希望预约的咨询时间段，点击"预约"按钮即可完成预约
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">
              <Globe className="inline h-4 w-4 mr-1" />
              时区设置
            </label>
            <Select value={selectedTimezone} onValueChange={updateTimezone}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择时区" />
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
              <p className="text-gray-500">加载可预约时间中...</p>
            </div>
          ) : availableSlots.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">暂无可预约时间</p>
              <p className="text-sm text-gray-400 mt-1">请稍后再试或联系治疗师</p>
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
                        {slot.therapist_name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {formatDateTime(slot.start_time)} - {formatDateTime(slot.end_time)}
                      </p>
                      <p className="text-xs text-gray-500">
                        时长: {getDuration(slot.start_time, slot.end_time)} 分钟
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => bookSlot(slot.id)}
                    disabled={bookingLoading === slot.id}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {bookingLoading === slot.id ? '预约中...' : '预约'}
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
