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
}

type ChatItem = { id: string; role: 'user' | 'assistant'; content: string }

export default function AIChat({ session }: AIChatProps) {
  const { t } = useTranslation()
  const [userProfile, setUserProfile] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [inputMessage, setInputMessage] = useState('')
  const [messages, setMessages] = useState<ChatItem[]>([])
  const [status, setStatus] = useState<'idle' | 'submitted' | 'streaming'>('idle')
  const [error, setError] = useState<Error | null>(null)
  const [slotOptions, setSlotOptions] = useState<{ therapistName: string; slots: any[] } | null>(null)
  const chatApi = new ChatAPI()

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
      const formatted = data.map((m: any, idx: number) => ({
        id: String(idx),
        role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.message || ''
      }))
      setMessages(formatted)
    }
  }

  const sendTextMessage = async (text: string) => {
    if (!text.trim()) return
    if (status === 'streaming' || status === 'submitted') return
    setError(null)
    try {
      setStatus('submitted')
      await supabase.from('chat_messages').insert({
        user_id: session.user.id,
        role: 'user',
        message: text,
        message_type: 'text',
        audio_url: ''
      })
      await UserProfileUpdater.updateUserProfile(session.user.id, text)
      const userItem: ChatItem = { id: String(Date.now()), role: 'user', content: text }
      const nextMessages = [...messages, userItem]
      setMessages(nextMessages)

      const resp = await chatApi.sendMessage(
        nextMessages.map(m => ({ role: m.role, content: m.content })),
        { ...(userProfile || {}), id: session.user.id },
        true
      )

      const contentType = resp.headers.get('content-type') || ''
      if (contentType.includes('application/json') || !resp.body) {
        const data = await resp.clone().json()
        let assistantText = data?.content || data?.message || ''
        if (Array.isArray(data?.toolResults)) {
          try {
            const parts: string[] = []
            for (const tr of data.toolResults) {
              if (tr.name === 'getTherapistAvailability' && tr.result?.success) {
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
              } else if (tr.name === 'createBooking' && tr.result?.success) {
                const d = tr.result.data || {}
                parts.push(d.message || t('tool_booking_created', { name: d.therapistName || '', dateTime: d.dateTime || '' }))
                setSlotOptions(null)
              } else if (tr.result?.error) {
                parts.push(t('tool_error', { error: tr.result.error }))
              }
            }
            if (parts.length > 0) assistantText = parts.join(' ')
          } catch {}
        }
        if (assistantText) {
          await supabase.from('chat_messages').insert({
            user_id: session.user.id,
            role: 'assistant',
            message: assistantText,
            message_type: 'text',
            audio_url: ''
          })
          updateStreamingMessage(assistantText)
        } else if (data?.error) {
          updateStreamingMessage(t('chat_error_generic'))
        }
      } else {
        setStatus('streaming')
        await handleStreamingResponse(resp)
      }
    } catch (e: any) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setStatus('idle')
    }
  }

  const handleSendMessage = async () => {
    const text = inputMessage
    if (!text.trim()) return
    setInputMessage('')
    await sendTextMessage(text)
  }

  const handleBookSlot = async (therapistName: string, slot: any) => {
    if (status === 'streaming' || status === 'submitted') return
    try {
      const whenLocal = new Date(slot.startTime).toLocaleString(undefined as any, { hour12: false })
      const text = t('chat_confirm_booking', { therapistName, whenLocal, iso: slot.startTime })
      setSlotOptions(null)
      await sendTextMessage(text)
    } catch {}
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
            } catch {}
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  const updateStreamingMessage = (content: string) => {
    setMessages(prev => {
      const last = prev[prev.length - 1]
      if (last?.role === 'assistant') {
        return prev.slice(0, -1).concat({ ...last, content })
      }
      return prev.concat({ id: String(Date.now()), role: 'assistant', content })
    })
  }

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
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}

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
                {t('chat_error_generic')} {error.message}
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
                    disabled={status === 'streaming' || status === 'submitted'}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-md text-sm"
                  >
                    {new Date(s.startTime).toLocaleString(undefined as any, { hour12: false })}
                  </button>
                ))}
              </div>
            </div>
          )}

          {import.meta.env?.DEV && (
            <div className="flex justify-center mt-4 mb-2 p-2 bg-gray-50 rounded-lg">
              <button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/setup/add-test-data', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' }
                    })
                    const result = await response.json()
                    alert(result.success ? '测试数据添加成功！' : '添加测试数据失败: ' + (result.error || '未知错误'))
                  } catch (error) {
                    alert('添加测试数据时发生错误: ' + (error instanceof Error ? error.message : String(error)))
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

        <div className="sticky bottom-0 border-t bg-white p-3 z-10 shadow-sm">
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
