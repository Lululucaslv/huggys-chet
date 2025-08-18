import { useState, useEffect, useRef } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { ChatAPI } from '../lib/chatApi'
import { UserProfileUpdater } from '../lib/userProfileUpdater'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { MessageCircle, Send, Loader2 } from 'lucide-react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  image_url?: string
  created_at: string
}

interface AIChatProps {
  session: Session
}

export default function AIChat({ session }: AIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
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

  const sendMessage = async () => {
    console.log('🚀 SENDMESSAGE v17 - AGGRESSIVE DEPLOYMENT FORCE CACHE BUST - FINAL FIX')
    console.log('🔥 v17 AGGRESSIVE DEPLOYMENT - AI AGENT TOOL CALLING RESULTS DISPLAY - CACHE BUST')
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
      console.log('🔥 v7 - About to insert user message to database')
      await supabase.from('chat_messages').insert({
        user_id: session.user.id,
        role: 'user',
        message: messageToSend,
        message_type: 'text',
        audio_url: ''
      })

      console.log('🔥 v7 - About to update user profile')
      await UserProfileUpdater.updateUserProfile(session.user.id, messageToSend)

      console.log('🔥 v7 - About to call chatAPI.sendMessage')
      const response = await chatAPI.sendMessage(
        messages.concat(userMessage).map(m => ({ role: m.role, content: m.content })),
        { ...userProfile, id: session.user.id },
        false
      )

      console.log('🔥 v7 - RESPONSE RECEIVED - CRITICAL DEBUG POINT')
      console.log('🔥 v7 - Response status:', response.status, 'ok:', response.ok)
      
      if (response.ok) {
        console.log('🔥 v7 - Response OK, calling handleNonStreamingResponse')
        await handleNonStreamingResponse(response)
        console.log('🔥 v7 - handleNonStreamingResponse completed')
      } else {
        console.error('🔥 v7 - Response NOT OK, status:', response.status)
        throw new Error(`API request failed: ${response.status}`)
      }
    } catch (error) {
      console.error('🔥 v7 - Error sending message:', error)
      setIsTyping(false)
    }
  }

  const handleNonStreamingResponse = async (response: Response) => {
    console.log('🚀 v17 - AGGRESSIVE DEPLOYMENT FORCE CACHE BUST - FINAL FIX')
    console.log('🔥 v17 - handleNonStreamingResponse called with response:', {
      status: response.status,
      statusText: response.statusText,
      bodyUsed: response.bodyUsed,
      ok: response.ok
    })
    
    try {
      console.log('🔥 v17 - About to parse response.json()')
      const result = await response.json()
      console.log('🔥 v17 - Full AI Agent API response:', result)
      
      let assistantMessage = ''
      
      console.log('🔧 DEBUGGING: Full API response structure:', JSON.stringify(result, null, 2))
      console.log('🔧 DEBUGGING: Response keys:', Object.keys(result))
      console.log('🔧 DEBUGGING: Has data?', !!result.data)
      console.log('🔧 DEBUGGING: Has message?', !!result.message)
      console.log('🔧 DEBUGGING: Has toolCalls?', !!result.toolCalls)
      console.log('🔧 DEBUGGING: Has toolResults?', !!result.toolResults)
      console.log('🔧 DEBUGGING: Has choices?', !!result.choices)
      
      if (result.success !== false && result.data && result.data.message) {
        console.log('🔥 v17 - SUCCESS: Using AI Agent response data.message:', result.data.message)
        assistantMessage = result.data.message
        
        if (result.data.toolCalls && result.data.toolResults) {
          console.log('🔥 v17 - SUCCESS: Tool calls detected:', result.data.toolCalls.length)
          console.log('🔥 v17 - SUCCESS: Tool results:', result.data.toolResults)
        }
      }
      else if (result.success !== false && result.message) {
        console.log('🔥 v17 - FALLBACK: Using direct result.message:', result.message)
        assistantMessage = result.message
        
        if (result.toolCalls && result.toolResults) {
          console.log('🔥 v17 - FALLBACK: Tool calls detected:', result.toolCalls.length)
          console.log('🔥 v17 - FALLBACK: Tool results:', result.toolResults)
        }
      }
      else if (result.choices?.[0]?.message?.content) {
        console.log('🔥 v17 - FALLBACK: Using OpenAI format:', result.choices[0].message.content)
        assistantMessage = result.choices[0].message.content
      }
      else if (result.success === false && result.error) {
        console.error('🔥 v17 - ERROR: API returned error:', result.error)
        assistantMessage = `抱歉，处理您的请求时遇到了错误：${result.error}`
      }
      else {
        console.error('🔥 v17 - ERROR: Unexpected response format:', result)
        console.error('🔧 DEBUGGING: Available response properties:', Object.keys(result))
        assistantMessage = '抱歉，处理您的请求时遇到了错误。请稍后再试。'
      }
      
      console.log('🔥 v17 - Final assistantMessage:', assistantMessage)
      
      const assistantChatMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: assistantMessage,
        created_at: new Date().toISOString()
      }
      
      console.log('🔥 v17 - About to add message to UI:', assistantChatMessage)
      setMessages(prev => [...prev, assistantChatMessage])
      
      console.log('🔥 v17 - About to save message to database')
      await supabase.from('chat_messages').insert({
        user_id: session.user.id,
        role: 'assistant',
        message: assistantMessage,
        message_type: 'text',
        audio_url: ''
      })
      
      console.log('🔥 v17 - Message saved to database successfully')
      
    } catch (error) {
      console.error('🔥 v17 - Error handling response:', error)
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '抱歉，处理您的请求时遇到了错误。请稍后再试。',
        created_at: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
    }
    
    console.log('🔥 v17 - About to set isTyping to false')
    setIsTyping(false)
    console.log('🔥 v17 - handleNonStreamingResponse function completed')
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
          {messages.map((message) => (
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
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-100 p-3 rounded-lg flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Huggy正在思考并可能调用工具查询信息... (v13工具调用修复)
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
              🔧 添加测试数据 (v17-AGGRESSIVE-DEPLOYMENT-FORCE-CACHE-BUST-FINAL-FIX)
            </button>
          </div>
          <div ref={messagesEndRef} />
        </div>
        
        <div className="flex gap-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="在这里输入您的想法和感受..."
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            disabled={isTyping}
          />
          <Button onClick={sendMessage} disabled={isTyping || !inputMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
