import { useState, useEffect, useRef } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { UserProfileUpdater } from '../lib/userProfileUpdater'
import { ChatAPI } from '../lib/chatApi'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { MessageCircle, Send, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface AIChatProps {
  session: Session
  onAfterToolAction?: () => void
}
function getSafeDisplayName(session: Session, profile: any, t: any): string {
  const emailName = (session.user.email || '').split('@')[0]
  if (profile && typeof profile.display_name === 'string') {
    const v = profile.display_name.trim()
    if (v) return v
  }
  return emailName || String(t('tool_therapist_fallback'))
}



export default function AIChat({ session, onAfterToolAction }: AIChatProps) {
  const { t } = useTranslation()
  const [userProfile, setUserProfile] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [inputMessage, setInputMessage] = useState('')
  const [messages, setMessages] = useState<Array<{ id: string, role: 'user' | 'assistant', content: string }>>([])
  const [status, setStatus] = useState<'idle' | 'submitted' | 'streaming'>('idle')
  const [error, setError] = useState<Error | null>(null)
  const chatApi = new ChatAPI()
  const [slotOptions, setSlotOptions] = useState<{ therapistName: string; slots: Array<{ id?: number | string; startTime: string; endTime?: string; therapistCode?: string }>; createEnabled?: boolean; targetUserId?: string | null } | null>(null)
  const handleBookSlot = async (therapistName: string, slot: { id?: string | number; startTime: string; therapistCode?: string }) => {
    if (status !== 'idle') return
    if (slotOptions && slotOptions.createEnabled === false) return
    setStatus('submitted')
    setError(null)
    try {
      setSlotOptions(null)
      const defaultCode = (typeof window !== 'undefined' && (window as any).__THERAPIST_DEFAULT_CODE__) || '8W79AL2B'
      const therapistCode = slot.therapistCode || defaultCode
      const targetUserId = slotOptions?.targetUserId || session.user.id
      const resp = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          therapistCode,
          userId: targetUserId,
          availabilityId: slot.id
        })
      })
      const data = await resp.json()
      if (resp.status === 409 || data?.error === 'slot_unavailable') {
        const msg = (t as any)('tool_slot_taken_retry') || '该时间已被占用，请再选一个'
        setMessages(prev => [...prev, { id: String(Date.now() + 1), role: 'assistant', content: msg }])
        return
      }
      if (!resp.ok || !data?.booking) {
        const errMsg = data?.error || (t as any)('tool_booking_failed') || '预约失败，请稍后再试'
        setMessages(prev => [...prev, { id: String(Date.now() + 2), role: 'assistant', content: errMsg }])
        return
      }
      const whenLocal = new Date(data.booking.start_utc || slot.startTime).toLocaleString(undefined as any, { hour12: false })
      const successText = (t as any)('tool_booking_created', { name: therapistName, dateTime: whenLocal }) || `已为您为 ${therapistName} 预约：${whenLocal}`
      setMessages(prev => [...prev, { id: String(Date.now() + 3), role: 'assistant', content: successText }])
      await supabase.from('chat_messages').insert({
        user_id: session.user.id,
        role: 'assistant',
        message: successText,
        message_type: 'text',
        audio_url: ''
      })
      if (typeof onAfterToolAction === 'function') onAfterToolAction()
    } catch (e: any) {
      const msg = e?.message || (t as any)('tool_booking_failed') || '预约失败，请稍后再试'
      setMessages(prev => [...prev, { id: String(Date.now() + 4), role: 'assistant', content: msg }])
    } finally {
      setStatus('idle')
    }
  }


  useEffect(() => {
    fetchUserProfile()
    fetchChatHistory()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, status])

  const fetchUserProfile = async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .single()
    
    setUserProfile(data)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as any).__APP_ROLE__ = 'therapist'
    }
  }, [userProfile])

  }

  const fetchChatHistory = async () => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true })
      .limit(50)
    if (data) {
      const formatted = data.map((m: any, idx: number) => ({
        id: String(idx),
        role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.message || ''
      }))
      setMessages(formatted)
    }
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return
    if (status === 'streaming' || status === 'submitted') return
    setError(null)
    try {
      setStatus('submitted')
      await supabase.from('chat_messages').insert({
        user_id: session.user.id,
        role: 'user',
        message: inputMessage,
        message_type: 'text',
        audio_url: ''
      })
      await UserProfileUpdater.updateUserProfile(session.user.id, inputMessage)
      const newItem = { id: String(Date.now()), role: 'user' as const, content: inputMessage }
      const nextMessages: Array<{ id: string; role: 'user' | 'assistant'; content: string }> = [...messages, newItem]
      setMessages(prev => [...prev, newItem])
      setInputMessage('')
      const resp = await chatApi.sendMessage(
        nextMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { ...(userProfile || {}), id: session.user.id },
        false,
        { mode: 'therapist' }
      )
      const data = await resp.json()
      const blocks = Array.isArray(data?.blocks) ? data.blocks : (Array.isArray(data?.toolResults) ? data.toolResults : [])
      let assistantText = String(
        (data && (data.text ?? data.reply?.content ?? data.content ?? data.response ?? '')) || ''
      ).trim()

      if (blocks.length) {
        try {
          const parts: string[] = []
          let hasTimeConfirm = false
          for (const tr of blocks) {
            if (tr?.name === 'getAvailability' && tr.result?.success) {
              const arr = Array.isArray(tr.result.data) ? tr.result.data : []
              const slots = arr.map((r: any) => ({
                id: r.id,
                startTime: r.start_time || r.startTime,
                endTime: r.end_time || r.endTime
              })).filter((s: any) => s.startTime)
              const displayName = getSafeDisplayName(session, userProfile, t)
              parts.push(t('tool_availability_count', { name: displayName, count: slots.length, extra: '' }))
              if (slots.length > 0) {
                setSlotOptions({ therapistName: displayName, slots: slots.slice(0, 8) })
              } else {
                setSlotOptions(null)
              }
            } else if (tr?.name === 'createBooking' && tr.result?.success) {
              const d = tr.result.data || {}
              parts.push(d.message || t('tool_booking_created', { name: d.therapistName || '', dateTime: d.dateTime || '' }))
              setSlotOptions(null)
              if (typeof onAfterToolAction === 'function') onAfterToolAction()
            } else if (tr?.name === 'getTherapistAvailability' && tr.result?.success) {
              const d = tr.result.data || {}
              const count = Array.isArray(d.availableSlots) ? d.availableSlots.length : 0
              parts.push(t('tool_availability_count', { name: d.therapistName || t('tool_therapist_fallback'), count, extra: d.message || '' }))
              if (Array.isArray(d.availableSlots) && d.availableSlots.length > 0) {
                setSlotOptions({
                  therapistName: d.therapistName || t('tool_therapist_fallback'),
                  slots: d.availableSlots.slice(0, 8)
                })
              } else {
                setSlotOptions(null)
              }
            } else if ((tr?.type === 'TIME_CONFIRM' || tr?.name === 'TIME_CONFIRM') && Array.isArray(tr.options)) {
              const slots = tr.options.map((opt: any) => ({
                id: opt.availabilityId,
                startTime: opt.startUTC,
                endTime: opt.endUTC,
                therapistCode: opt.therapistCode
              })).filter((s: any) => s.startTime)
              const nameFromOpt = (tr.options && tr.options[0] && (tr.options[0].therapistName || tr.options[0].therapist_name)) || null
              const displayName = nameFromOpt || getSafeDisplayName(session, userProfile, t)
              parts.push(t('tool_availability_count', { name: displayName, count: slots.length, extra: '' }))
              if (slots.length > 0) {
                setSlotOptions({ therapistName: displayName, slots: slots.slice(0, 8), createEnabled: !!tr.createEnabled, targetUserId: tr.targetUserId || null })
              } else {
                setSlotOptions(null)
              }
              hasTimeConfirm = true
            } else if (tr?.result?.error) {
              parts.push(t('tool_error', { error: tr.result.error }))
            }
          }
          if ((hasTimeConfirm || !assistantText) && parts.length > 0) {
            assistantText = parts.join(' ')
          }
        } catch {}
      }

      if (!assistantText) assistantText = '我在，愿意听你说说。'

      setMessages(prev => [...prev, { id: String(Date.now() + 1), role: 'assistant', content: assistantText }])
      await supabase.from('chat_messages').insert({
        user_id: session.user.id,
        role: 'assistant',
        message: assistantText,
        message_type: 'text',
        audio_url: ''
      })

      const names = blocks.map((r: any) => r?.name || r?.function?.name).filter(Boolean)
      const modified = names.some((n: string) => ['setAvailability', 'deleteAvailability'].includes(String(n)))
      if (modified && typeof onAfterToolAction === 'function') {
        onAfterToolAction()
      }
    } catch (e: any) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setStatus('idle')
    }
  }



          
          {slotOptions && slotOptions.slots?.length > 0 && (
            <div className="mt-2">
              <div className="text-gray-500 text-sm mb-2">{t('chat_choose_slot')}</div>
              <div className="flex flex-wrap gap-2">
                {slotOptions.slots.map((s) => (
                  <button
                    key={s.id || s.startTime}
                    onClick={() => handleBookSlot(slotOptions.therapistName, s)}
                    disabled={status === 'streaming' || status === 'submitted' || (slotOptions?.createEnabled === false)}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-md text-sm"
                  >
                    {slotOptions?.therapistName
                      ? `${slotOptions.therapistName} — ${new Date(s.startTime).toLocaleString(undefined as any, { hour12: false })}`
                      : new Date(s.startTime).toLocaleString(undefined as any, { hour12: false })}
                  </button>
                ))}
              </div>
            </div>
          )}
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <Card className="h-[80vh] max-h-[80vh] flex flex-col">
      <CardHeader className="shrink-0">
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          {t('nav_chat')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col p-0">
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 p-4 pb-24" id="chat-scroll-area">
          {messages.map((message: any) => {
            let summary: any = null
            try {
              const obj = typeof message.content === 'string' ? JSON.parse(message.content) : null
              if (obj && obj.type === 'SESSION_SUMMARY') summary = obj
            } catch {}
            if (summary) {
              const sections = Array.isArray(summary.payload?.sections) ? summary.payload.sections : []
              return (
                <div key={message.id} className="flex justify-start">
                  <div className="max-w-[80%] p-3 rounded-lg bg-gray-800 text-white border border-gray-700">
                    <div className="space-y-2">
                      {sections.map((s: any, i: number) => (
                        <div key={i} className="rounded-lg border p-3">
                          <div className="text-sm font-semibold">{s.title}</div>
                          <ul className="mt-2 space-y-1">
                            {(s.items || []).map((it: any, j: number) => (
                              <li key={j} className="text-sm text-muted-foreground">
                                {typeof it === 'string' ? it : JSON.stringify(it).slice(0, 240)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            }
            return (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-800 text-white border border-gray-700'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            )
          })}
          {(status === 'streaming' || status === 'submitted') && (
            <div className="flex justify-start">
              <div className="bg-gray-100 p-3 rounded-lg flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('chat_thinking')}
              </div>
            </div>
          )}
          
          {error && (
            <div className="flex justify-start">
              <div className="bg-red-100 p-3 rounded-lg text-red-700">
                {t('chat_error_generic')} 错误: {error.message}
              </div>
            </div>
          )}
          
          {slotOptions && slotOptions.slots?.length > 0 && (
            <div className="mt-2">
              <div className="text-gray-500 text-sm mb-2">{t('chat_choose_slot')}</div>
              <div className="flex flex-wrap gap-2">
                {slotOptions.slots.map((s) => (
                  <button
                    key={s.id || s.startTime}
                    onClick={() => handleBookSlot(slotOptions.therapistName, s)}
                    disabled={status === 'streaming' || status === 'submitted' || (slotOptions?.createEnabled === false)}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-md text-sm"
                  >
                    {slotOptions?.therapistName
                      ? `${slotOptions.therapistName} — ${new Date(s.startTime).toLocaleString(undefined as any, { hour12: false })}`
                      : new Date(s.startTime).toLocaleString(undefined as any, { hour12: false })}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {import.meta.env.DEV && (
            <div className="flex justify-center mt-4 mb-2 p-2 bg-gray-800 rounded-lg">
              <button 
                onClick={async () => {
                  try {
                    const response = await fetch('/api/setup/add-test-data', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' }
                    });
                    const result = await response.json();
                    alert(result.success ? '测试数据添加成功！' : '添加测试数据失败: ' + (result.error || '未知错误'));
                  } catch (error) {
                    alert('添加测试数据时发生错误: ' + (error instanceof Error ? error.message : String(error)));
                  }
                }}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm"
              >
                🔧 添加测试数据
              </button>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="sticky bottom-0 border-t border-purple-400/30 bg-[#0a0a0a] p-3 z-10 backdrop-blur-sm">
          <div className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={t('chat_input_placeholder')}
              disabled={status === 'streaming' || status === 'submitted'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
            />
            <Button 
              onClick={handleSendMessage} 
              disabled={status === 'streaming' || status === 'submitted' || !inputMessage.trim()}
            >
              {status === 'submitted' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
