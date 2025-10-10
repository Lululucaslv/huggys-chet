import { useState, useEffect, useRef } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { ChatAPI } from '../lib/chatApi'
import { UserProfileUpdater } from '../lib/userProfileUpdater'
import { Send, Loader2, Camera, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { TimeConfirmCard } from '../components/chat/TimeConfirmCard'


interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  image_url?: string
  created_at: string
}

interface ChatPageProps {
  session: Session
}


export default function ChatPage({ session }: ChatPageProps) {
  const { t, i18n } = useTranslation()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [slotOptions, setSlotOptions] = useState<{ therapistName: string; slots: any[] } | null>(null)
  const chatAPI = new ChatAPI()

  useEffect(() => {
    fetchUserProfile()
    fetchChatHistory()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchUserProfile = async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .single()
    
    setUserProfile(data)
  }

  const fetchChatHistory = async () => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true })
      .limit(50)
    
    if (data) {
      const formattedMessages = data.map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.message,
        image_url: msg.image_url,
        created_at: msg.created_at
      }))
      setMessages(formattedMessages)
    }
  }
  const sendTextMessage = async (text: string) => {
    if (!text.trim()) return
    if (isTyping) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setIsTyping(true)

    try {
      await supabase.from('chat_messages').insert({
        user_id: session.user.id,
        role: 'user',
        message: text,
        message_type: 'text',
        audio_url: ''
      })

      await UserProfileUpdater.updateUserProfile(session.user.id, text)

      const response = await chatAPI.sendMessage(
        messages.concat(userMessage).map(m => ({ role: m.role, content: m.content })),
        userProfile,
        true
      )

      if (response.ok) {
        const contentType = response.headers.get('content-type') || ''
        if (contentType.includes('application/json') || !response.body) {
          const data = await response.clone().json()
          let assistantText = String(
            (data && (data.text ?? data.reply?.content ?? data.content ?? data.response ?? '')) || ''
          ).trim()
          if (Array.isArray(data?.toolResults)) {
            try {
              const trTC = data.toolResults.find((tr: any) => tr?.type === 'TIME_CONFIRM' && Array.isArray(tr.options))
              if (trTC) {
                const opts = trTC.options
                const slots = opts.slice(0, 8).map((o: any) => ({
                  id: o.availabilityId || o.id || o.startUTC,
                  availabilityId: o.availabilityId || o.id || null,
                  therapistCode: o.therapistCode || ((window as any)?.__THERAPIST_DEFAULT_CODE__ || '8W79AL2B'),
                  startTime: o.startUTC || o.start_time || o.startTime,
                  endTime: o.endUTC || o.end_time || o.endTime
                }))
                const count = slots.length
                const nameFromOpt = (opts && opts[0] && (opts[0].therapistName || (opts[0] as any).therapist_name)) || null
                if (count > 0) {
                  setSlotOptions({ therapistName: nameFromOpt || t('tool_therapist_fallback'), slots })
                } else {
                  setSlotOptions(null)
                }
                if (!assistantText) {
                  assistantText = t('tool_availability_count', { name: nameFromOpt || t('tool_therapist_fallback'), count, extra: '' })
                }
              }
            } catch {}
            try {
              const parts: string[] = []
              for (const tr of data.toolResults) {
                if (tr.name === 'getTherapistAvailability' && tr.result?.success) {
                  const d = tr.result.data || {}
                  const count = Array.isArray(d.availableSlots) ? d.availableSlots.length : 0
                  parts.push(t('tool_availability_count', { name: d.therapistName || t('tool_therapist_fallback'), count, extra: d.message || '' }))
                  if (Array.isArray(d.availableSlots) && d.availableSlots.length > 0) {
                    console.log('[ChatPage] setting slotOptions', d.therapistName, d.availableSlots.length)
                    setSlotOptions({
                      therapistName: d.therapistName || t('tool_therapist_fallback'),
                      slots: d.availableSlots.slice(0, 8)
                    })
                  } else {
                    console.log('[ChatPage] clearing slotOptions (no slots)')
                    setSlotOptions(null)
                  }
                } else if (tr.name === 'createBooking' && tr.result?.success) {
                  const d = tr.result.data || {}
                  parts.push(d.message || t('tool_booking_created', { name: d.therapistName || '', dateTime: d.dateTime || '' }))
                  setSlotOptions(null)
                } else if (tr.result?.error) {
                  parts.push(t('tool_error', { error: tr.result.error }))
                }
              }
              if (!assistantText && parts.length > 0) assistantText = parts.join(' ')
            } catch {}
          }
          if (!assistantText) assistantText = '我在，愿意听你说说。'
          await supabase.from('chat_messages').insert({
            user_id: session.user.id,
            role: 'assistant',
            message: assistantText,
            message_type: 'text',
            audio_url: ''
          })
          updateStreamingMessage(assistantText)
        } else {
          await handleStreamingResponse(response)
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setIsTyping(false)
    }
  }


  const sendMessage = async () => {
    if (!inputMessage.trim()) return
    if (isTyping) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: inputMessage,
      created_at: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    const messageToSend = inputMessage
    setInputMessage('')
    setIsTyping(true)

    try {
      await supabase.from('chat_messages').insert({
        user_id: session.user.id,
        role: 'user',
        message: messageToSend,
        message_type: 'text',
        audio_url: ''
      })

      await UserProfileUpdater.updateUserProfile(session.user.id, messageToSend)

      const response = await chatAPI.sendMessage(
        messages.concat(userMessage).map(m => ({ role: m.role, content: m.content })),
        userProfile,
        true
      )

      if (response.ok) {
        const contentType = response.headers.get('content-type') || ''
        if (contentType.includes('application/json') || !response.body) {
          const data = await response.clone().json()
          let assistantText = String(
            (data && (data.text ?? data.reply?.content ?? data.content ?? data.response ?? '')) || ''
          ).trim()
          if (Array.isArray(data?.toolResults)) {
            try {
              const trTC = data.toolResults.find((tr: any) => tr?.type === 'TIME_CONFIRM' && Array.isArray(tr.options))
              if (trTC) {
                const opts = trTC.options
                const slots = opts.slice(0, 8).map((o: any) => ({
                  id: o.availabilityId || o.id || o.startUTC,
                  availabilityId: o.availabilityId || o.id || null,
                  therapistCode: o.therapistCode || ((window as any)?.__THERAPIST_DEFAULT_CODE__ || '8W79AL2B'),
                  startTime: o.startUTC || o.start_time || o.startTime,
                  endTime: o.endUTC || o.end_time || o.endTime
                }))
                const count = slots.length
                const nameFromOpt = (opts && opts[0] && (opts[0].therapistName || (opts[0] as any).therapist_name)) || null
                if (count > 0) {
                  setSlotOptions({ therapistName: nameFromOpt || t('tool_therapist_fallback'), slots })
                } else {
                  setSlotOptions(null)
                }
                if (!assistantText) {
                  assistantText = t('tool_availability_count', { name: nameFromOpt || t('tool_therapist_fallback'), count, extra: '' })
                }
              }
            } catch {}
          }

          if (Array.isArray(data?.toolResults)) {
            try {
              const parts: string[] = []
              for (const tr of data.toolResults) {
                if (tr.name === 'getTherapistAvailability' && tr.result?.success) {
                  const d = tr.result.data || {}
                  const count = Array.isArray(d.availableSlots) ? d.availableSlots.length : 0
                  parts.push(t('tool_availability_count', { name: d.therapistName || t('tool_therapist_fallback'), count, extra: d.message || '' }))
                  if (Array.isArray(d.availableSlots) && d.availableSlots.length > 0) {
                    console.log('[ChatPage] setting slotOptions', d.therapistName, d.availableSlots.length)
                    setSlotOptions({
                      therapistName: d.therapistName || t('tool_therapist_fallback'),
                      slots: d.availableSlots.slice(0, 8)
                    })
                  } else {
                    console.log('[ChatPage] clearing slotOptions (no slots)')
                    setSlotOptions(null)
                  }
                } else if (tr.name === 'createBooking' && tr.result?.success) {
                  const d = tr.result.data || {}
                  parts.push(d.message || t('tool_booking_created', { name: d.therapistName || '', dateTime: d.dateTime || '' }))
                  setSlotOptions(null)
                } else if (tr.result?.error) {
                  parts.push(t('tool_error', { error: tr.result.error }))
                }
              }
              if (!assistantText && parts.length > 0) assistantText = parts.join(' ')
            } catch {}
          }
          if (!assistantText) assistantText = '我在，愿意听你说说。'
          await supabase.from('chat_messages').insert({
            user_id: session.user.id,
            role: 'assistant',
            message: assistantText,
            message_type: 'text',
            audio_url: ''
          })
          updateStreamingMessage(assistantText)
        } else {
          await handleStreamingResponse(response)
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setIsTyping(false)
    }
  }

  const handleBookSlot = async (therapistName: string, slot: any) => {
    if (isTyping) return
    try {
      if (slot?.availabilityId || slot?.id) {
        const body = {
          availabilityId: slot.availabilityId || slot.id,
          therapistCode: slot.therapistCode || ((window as any)?.__THERAPIST_DEFAULT_CODE__ || '8W79AL2B'),
          userId: session.user.id,
          startUTC: slot.startTime
        }
        const r = await fetch('/api/bookings/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
        const data = await r.json().catch(() => ({}))
        if (data?.booking) {
          setSlotOptions(null)
          const currentLocale = i18n.resolvedLanguage === 'zh' ? 'zh-CN' : i18n.resolvedLanguage || 'en'
          const whenLocal = new Date(data.booking.start_utc || slot.startTime).toLocaleString(currentLocale as any, { hour12: false })
          const okText = t('tool_booking_created', { name: therapistName || '', dateTime: whenLocal })
          await supabase.from('chat_messages').insert({
            user_id: session.user.id,
            role: 'assistant',
            message: okText,
            message_type: 'text',
            audio_url: ''
          })
          updateStreamingMessage(okText)
          return
        } else if (r.status === 409 || String(data?.error || '').includes('slot_unavailable')) {
          const conflictText = t('tool_slot_taken_retry', '该时间已被占用，请再选一个')
          updateStreamingMessage(conflictText)
          return
        } else {
          const errText = t('tool_booking_failed', '预约失败，请稍后再试')
          updateStreamingMessage(errText)
          return
        }
      }
      const currentLocale = i18n.resolvedLanguage === 'zh' ? 'zh-CN' : i18n.resolvedLanguage || 'en'
      const whenLocal = new Date(slot.startTime).toLocaleString(currentLocale as any, { hour12: false })
      const text = t('chat_confirm_booking', { therapistName, whenLocal, iso: slot.startTime })
      setSlotOptions(null)
      await sendTextMessage(text)
    } catch (e) {
      const errText = t('tool_booking_failed', '预约失败，请稍后再试')
      updateStreamingMessage(errText)
    }
  }

  const handleStreamingResponse = async (response: Response) => {
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let assistantMessage = ''

    if (!reader) return

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              await supabase.from('chat_messages').insert({
                user_id: session.user.id,
                role: 'assistant',
                message: assistantMessage,
                message_type: 'text',
                audio_url: ''
              })
              return
            }

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content
              if (content) {
                assistantMessage += content
                updateStreamingMessage(assistantMessage)
              }
            } catch (e) {
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  const updateStreamingMessage = (content: string) => {
    setMessages(prev => {
      const lastMessage = prev[prev.length - 1]
      if (lastMessage?.role === 'assistant') {
        return prev.slice(0, -1).concat({
          ...lastMessage,
          content: content
        })
      } else {
        return prev.concat({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: content,
          created_at: new Date().toISOString()
        })
      }
    })
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleQuickReply = (message: string) => {
    setInputMessage(message)
  }

  return (
    <div className="relative min-h-screen bg-gray-50">
      {/* Header */}
      <header className="relative z-10 bg-white border-b border-gray-200 sticky top-0 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-lg">🤗</span>
              </div>
              <h1 className="text-xl font-semibold tracking-wide text-gray-800">
                {t('chat_header_title')}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/settings" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Settings className="h-5 w-5 text-gray-600" />
              </Link>
              <LanguageSwitcher />
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>{t('chat_status_online')}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col h-[calc(100vh-140px)]">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto space-y-6">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-3xl">🤗</span>
                </div>
                <div className="message-content">
                  <h2 className="text-2xl font-semibold tracking-wide text-gray-800 mb-4">{t('chat_intro_title')}</h2>
                  <p className="text-gray-600 mb-6">{t('chat_intro_subtitle')}</p>
                  
                  <div className="memory-info text-left max-w-2xl mx-auto bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                    <p className="text-gray-800 font-semibold mb-4">{t('chat_intro_superpowers')}</p>
                    <ul className="text-left space-y-2 text-gray-600">
                      <li>✅ <strong>{t('chat_intro_power_memory')}</strong></li>
                      <li>✅ <strong>{t('chat_intro_power_personality')}</strong></li>
                      <li>✅ <strong>{t('chat_intro_power_interests')}</strong></li>
                      <li>✅ <strong>{t('chat_intro_power_online')}</strong></li>
                    </ul>
                    <p className="text-gray-600 mt-6">{t('chat_intro_closing')}</p>
                  </div>
                </div>
              </div>

            )}
            
            {messages.map((message) => {
              try {
                const obj = JSON.parse(message.content || '')
                if (obj && obj.type === 'TIME_CONFIRM') {
                  const p = obj.payload || {}
                  return (
                    <div key={message.id} className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm">🤗</span>
                      </div>
                      <div className="max-w-[75%]">
                        <TimeConfirmCard
                          therapist={p.therapist}
                          date={p.date || null}
                          startTime={p.startTime || null}
                          endTime={p.endTime || null}
                          timezone={p.timezone || null}
                          candidates={Array.isArray(p.candidates) ? p.candidates : []}
                          onConfirm={(sel: any) => {
                            const date = sel?.date || p.date || null
                            const startTime = sel?.startTime || p.startTime || null
                            const endTime = sel?.endTime || p.endTime || null
                            const timezone = p.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
                            const payload = {
                              type: 'USER_CONFIRM_TIME',
                              payload: { therapist: p.therapist, date, startTime, endTime, timezone }
                            }
                            setInputMessage(JSON.stringify(payload))
                            sendMessage()
                          }}
                          onCancel={() => {}}
                        />
                      </div>
                    </div>
                  )
                }
              } catch {}
              return (
                <div
                  key={message.id}
                  className={`flex items-start gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm">🤗</span>
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] px-6 py-4 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-md shadow-sm'
                        : 'bg-white text-gray-800 rounded-bl-md border border-gray-200 shadow-sm'
                    }`}
                    style={{
                      fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                    }}
                  >
                    {message.content}
                  </div>
                  {message.role === 'user' && (
                    <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm">👤</span>
                    </div>
                  )}
                </div>
              )
            })}
            
            {isTyping && (
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 animate-spin">
                  <span className="text-white text-sm">🤗</span>
                </div>
                <div className="bg-white border border-gray-200 shadow-sm px-6 py-4 rounded-2xl rounded-bl-md flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-600" />
                  <span className="text-gray-800">{t('chat_thinking')}</span>
                </div>
              </div>
            )}
            {slotOptions && slotOptions.slots?.length > 0 && (
              <div className="mt-4 mb-2">
                <div className="text-gray-600 text-sm mb-2">{t('chat_choose_slot')}</div>
                <div className="flex flex-wrap gap-2">
                  {slotOptions.slots.map((s) => (
                    <button
                      key={s.id || s.startTime}
                      onClick={() => handleBookSlot(slotOptions.therapistName, s)}
                      disabled={isTyping}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors shadow-sm"
                    >
                      {slotOptions.therapistName
                        ? `${slotOptions.therapistName} — ${new Date(s.startTime).toLocaleString((i18n.resolvedLanguage === 'zh' ? 'zh-CN' : i18n.resolvedLanguage || 'en') as any, { hour12: false })}`
                        : new Date(s.startTime).toLocaleString((i18n.resolvedLanguage === 'zh' ? 'zh-CN' : i18n.resolvedLanguage || 'en') as any, { hour12: false })}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Quick Reply Buttons */}
          {messages.length === 0 && (
            <div className="px-6 pb-4">
              <div className="text-center">
                <small className="text-gray-500 block mb-4">{t('chat_quick_user_label')}</small>
                <div className="flex flex-wrap justify-center gap-3 mb-4">
                  <button 
                    onClick={() => handleQuickReply(t('chat_quick_feeling_tired'))}
                    className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-full text-sm transition-colors shadow-sm"
                  >
                    {t('chat_quick_feeling_tired')}
                  </button>
                  <button 
                    onClick={() => handleQuickReply(t('chat_quick_want_chat'))}
                    className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-full text-sm transition-colors shadow-sm"
                  >
                    {t('chat_quick_want_chat')}
                  </button>
                  <button 
                    onClick={() => handleQuickReply(t('chat_quick_share_today'))}
                    className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-full text-sm transition-colors shadow-sm"
                  >
                    {t('chat_quick_share_today')}
                  </button>
                  <button 
                    onClick={() => handleQuickReply(t('chat_quick_worried'))}
                    className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-full text-sm transition-colors shadow-sm"
                  >
                    {t('chat_quick_worried')}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Input Area */}
          <div className="border-t border-gray-200 bg-white p-6">
            <div className="flex gap-4 items-end">
              <button className="p-3 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-full transition-colors">
                <Camera className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex-1">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={t('chat_input_placeholder')}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                  disabled={isTyping}
                  className="w-full bg-white border border-gray-300 text-gray-800 placeholder-gray-400 rounded-lg px-4 py-3 resize-none focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
                  rows={3}
                  maxLength={2000}
                  style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                  }}
                />
                <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
                  <span>{t('chat_char_count', { count: inputMessage.length, max: 2000 })}</span>
                  <span>🔒 {t('chat_privacy_notice')}</span>
                </div>
              </div>
              <button 
                onClick={sendMessage} 
                disabled={isTyping || !inputMessage.trim()}
                className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:opacity-50 rounded-full transition-colors shadow-sm"
              >
                <Send className="h-5 w-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
