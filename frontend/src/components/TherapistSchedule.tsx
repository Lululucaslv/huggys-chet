import { useState, useEffect } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Clock, Plus, Trash2 } from 'lucide-react'

interface AvailabilitySlot {
  id: number
  therapist_id: string
  start_time: string
  end_time: string
  is_booked: boolean
  created_at: string
  updated_at: string
}

interface TherapistScheduleProps {
  session: Session
}

export default function TherapistSchedule({ session }: TherapistScheduleProps) {
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([])
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userProfile, setUserProfile] = useState<any>(null)

  useEffect(() => {
    fetchUserProfile()
  }, [session])

  useEffect(() => {
    if (userProfile) {
      fetchAvailabilitySlots()
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
            life_status: 'therapist'
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
    } catch (err) {
      console.error('Error creating user profile:', err)
      setError('创建用户档案失败，请重试')
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

  const addAvailabilitySlot = async () => {
    if (!startTime || !endTime || !userProfile) {
      setError('请填写开始时间和结束时间')
      return
    }

    if (new Date(startTime) >= new Date(endTime)) {
      setError('结束时间必须晚于开始时间')
      return
    }

    if (new Date(startTime) <= new Date()) {
      setError('开始时间必须是未来时间')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('availability')
        .insert([
          {
            therapist_id: userProfile.id,
            start_time: startTime,
            end_time: endTime,
            is_booked: false
          }
        ])
        .select()

      if (error) {
        console.error('Error adding availability slot:', error)
        setError('添加时间段失败，请重试')
        return
      }

      setStartTime('')
      setEndTime('')
      fetchAvailabilitySlots()
    } catch (err) {
      console.error('Error:', err)
      setError('添加时间段失败，请重试')
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
        setError('删除时间段失败，请重试')
        return
      }

      fetchAvailabilitySlots()
    } catch (err) {
      console.error('Error:', err)
      setError('删除时间段失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
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
            <Plus className="h-5 w-5" />
            添加可预约时间
          </CardTitle>
          <CardDescription>
            设置您的可预约时间段，客户将能够在这些时间预约咨询
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="start-time" className="block text-sm font-medium text-gray-700 mb-1">
                开始时间
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
                结束时间
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
            {loading ? '添加中...' : '添加时间段'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            我的可预约时间
          </CardTitle>
          <CardDescription>
            管理您的可预约时间段，已被预约的时间段不会显示在此列表中
          </CardDescription>
        </CardHeader>
        <CardContent>
          {availabilitySlots.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">暂无可预约时间段</p>
              <p className="text-sm text-gray-400 mt-1">添加您的第一个可预约时间段</p>
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
                        时长: {Math.round((new Date(slot.end_time).getTime() - new Date(slot.start_time).getTime()) / (1000 * 60))} 分钟
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
                    <Trash2 className="h-4 w-4" />
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
