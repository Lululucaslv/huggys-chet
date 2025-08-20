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


export default function AIChat({ session }: AIChatProps) {
  const { t } = useTranslation()
  const [userProfile, setUserProfile] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [inputMessage, setInputMessage] = useState('')
  const [messages, setMessages] = useState<Array<{ id: string, role: 'user' | 'assistant', content: string }>>([])
  const [status, setStatus] = useState<'idle' | 'submitted' | 'streaming'>('idle')
  const [error, setError] = useState<Error | null>(null)
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
        false
      )
      const data = await resp.json()
      if (data && data.success) {
        const content = (data.content || '').toString()
        setMessages(prev => [...prev, { id: String(Date.now() + 1), role: 'assistant', content }])
        await supabase.from('chat_messages').insert({
          user_id: session.user.id,
          role: 'assistant',
          message: content,
          message_type: 'text',
          audio_url: ''
        })
      } else {
        const errMsg = (data && (data.error || data.details)) ? String(data.error || data.details) : 'Unknown error'
        setError(new Error(errMsg))
      }
    } catch (e: any) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setStatus('idle')
    }
  }



  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          {t('nav_chat')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messages.map((message: any) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
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
                {t('chat_error_generic')} 错误: {error.message}
              </div>
            </div>
          )}
          
          <div className="flex justify-center mt-4 mb-2 p-2 bg-gray-50 rounded-lg">
            <button 
              onClick={async () => {
                try {
                  console.log('🔧 Testing: Clicking Add Test Data button');
                  const response = await fetch('/api/setup/add-test-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                  });
                  const result = await response.json();
                  console.log('🔧 Testing: Add test data response:', result);
                  if (result.success) {
                    alert('测试数据添加成功！现在可以测试AI Agent工具调用功能了。');
                  } else {
                    alert('添加测试数据失败: ' + (result.error || '未知错误'));
                  }
                } catch (error) {
                  console.error('Error adding test data:', error);
                  alert('添加测试数据时发生错误: ' + (error instanceof Error ? error.message : String(error)));
                }
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm"
            >
              🔧 添加测试数据 (v35简化工具调用-边缘运行时兼容性-修复500错误-最终修复)
            </button>
          </div>
          <div ref={messagesEndRef} />
        </div>
        
        <div className="flex gap-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={t('chat_input_placeholder')}
            disabled={status === 'streaming' || status === 'submitted'}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={status === 'streaming' || status === 'submitted' || !inputMessage.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
