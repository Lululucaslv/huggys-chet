import { useState, useEffect, useRef } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useChat } from 'ai/react'
import { UserProfileUpdater } from '../lib/userProfileUpdater'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { MessageCircle, Send, Loader2 } from 'lucide-react'

interface AIChatProps {
  session: Session
}

export default function AIChat({ session }: AIChatProps) {
  const [userProfile, setUserProfile] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/agent/chat',
    body: {
      tool: 'chatWithTools',
      userId: session.user.id
    },
    onFinish: async (message: any) => {
      console.log('🔥 STREAMING - Message finished:', message)
      await supabase.from('chat_messages').insert({
        user_id: session.user.id,
        role: 'assistant',
        message: message.content,
        message_type: 'text',
        audio_url: ''
      })
    },
    onError: (error: any) => {
      console.error('🔥 STREAMING - Error:', error)
    }
  })

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
      console.log('🔥 STREAMING - Loaded chat history:', data.length, 'messages')
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('🚀 STREAMING v26 - VERCEL AI SDK IMPLEMENTATION')
    console.log('🔥 v26 STREAMING - AI AGENT TOOL CALLING WITH STREAMING RESPONSES')
    console.log('🔥 v26 - DEPLOYMENT TIMESTAMP:', new Date().toISOString())
    
    if (!input.trim()) return
    if (isLoading) return

    try {
      console.log('🔥 STREAMING - About to insert user message to database')
      await supabase.from('chat_messages').insert({
        user_id: session.user.id,
        role: 'user',
        message: input,
        message_type: 'text',
        audio_url: ''
      })

      console.log('🔥 STREAMING - About to update user profile')
      await UserProfileUpdater.updateUserProfile(session.user.id, input)

      console.log('🔥 STREAMING - About to submit to useChat hook')
      handleSubmit(e)
      
    } catch (error) {
      console.error('🔥 STREAMING - Error in onSubmit:', error)
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
          Huggy AI 心理咨询
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
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 p-3 rounded-lg flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Huggy正在思考并可能调用工具查询信息... (v26流式响应实现)
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
              🔧 添加测试数据 (v26流式响应-Vercel AI SDK-工具调用流式实现)
            </button>
          </div>
          <div ref={messagesEndRef} />
        </div>
        
        <form onSubmit={onSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="在这里输入您的想法和感受..."
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
