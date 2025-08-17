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
    console.log('🚀 SENDMESSAGE FUNCTION CALLED - DEBUGGING ACTIVE')
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
      console.log('🔥 About to insert user message to database')
      await supabase.from('chat_messages').insert({
        user_id: session.user.id,
        role: 'user',
        message: messageToSend,
        message_type: 'text',
        audio_url: ''
      })

      console.log('🔥 About to update user profile')
      await UserProfileUpdater.updateUserProfile(session.user.id, messageToSend)

      console.log('🔥 About to call chatAPI.sendMessage')
      const response = await chatAPI.sendMessage(
        messages.concat(userMessage).map(m => ({ role: m.role, content: m.content })),
        { ...userProfile, id: session.user.id },
        false
      )

      console.log('🔥 RESPONSE RECEIVED - CRITICAL DEBUG POINT')
      console.log('🔥 Response received in AIChat, checking response.ok:', response.ok, 'status:', response.status)
      console.log('🔥 Response headers:', Object.fromEntries(response.headers.entries()))
      console.log('🔥 Response bodyUsed:', response.bodyUsed)
      console.log('🔥 Response status type:', typeof response.status)
      console.log('🔥 Response status === 200:', response.status === 200)
      console.log('🔥 Response status == 200:', response.status == 200)
      console.log('🔥 About to enter if condition check')
      
      // Always call handleNonStreamingResponse for status 200, regardless of response.ok
      if (response.status === 200) {
        console.log('🔥 Status is 200, calling handleNonStreamingResponse')
        await handleNonStreamingResponse(response)
      } else {
        console.error('🔥 Response not OK, status:', response.status, 'statusText:', response.statusText)
        console.error('🔥 About to show error message and set isTyping false')
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '抱歉，处理您的请求时遇到了错误。请稍后再试。',
          created_at: new Date().toISOString()
        }
        setMessages(prev => [...prev, errorMessage])
        setIsTyping(false)
      }
      console.log('🔥 Finished if/else condition check')
    } catch (error) {
      console.error('🔥 Error sending message:', error)
      setIsTyping(false)
    }
  }

  const handleNonStreamingResponse = async (response: Response) => {
    console.log('🚀 HANDLENONSTREAMINGRESPONSE FUNCTION CALLED - DEBUGGING ACTIVE')
    console.log('🔥 handleNonStreamingResponse called with response:', {
      status: response.status,
      statusText: response.statusText,
      bodyUsed: response.bodyUsed,
      ok: response.ok
    })
    
    try {
      console.log('🔥 About to parse response.json()')
      const result = await response.json()
      console.log('🔥 Full AI Agent API response:', result)
      
      let assistantMessage = ''
      
      if (result.message) {
        console.log('🔥 Using result.message:', result.message)
        assistantMessage = result.message
      }
      else if (result.choices?.[0]?.message?.content) {
        console.log('🔥 Using result.choices[0].message.content:', result.choices[0].message.content)
        assistantMessage = result.choices[0].message.content
      }
      else if (result.success && result.data && result.data.message) {
        console.log('🔥 Using result.data.message:', result.data.message)
        assistantMessage = result.data.message
      } 
      else {
        console.error('🔥 Unexpected response format:', result)
        assistantMessage = '抱歉，处理您的请求时遇到了错误。请稍后再试。'
      }
      
      console.log('🔥 Final assistantMessage:', assistantMessage)
      
      const assistantChatMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: assistantMessage,
        created_at: new Date().toISOString()
      }
      
      console.log('🔥 About to add message to UI:', assistantChatMessage)
      setMessages(prev => [...prev, assistantChatMessage])
      
      console.log('🔥 About to save message to database')
      await supabase.from('chat_messages').insert({
        user_id: session.user.id,
        role: 'assistant',
        message: assistantMessage,
        message_type: 'text',
        audio_url: ''
      })
      
      console.log('🔥 Message saved to database successfully')
      
    } catch (error) {
      console.error('🔥 Error handling response:', error)
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '抱歉，处理您的请求时遇到了错误。请稍后再试。',
        created_at: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
    }
    
    console.log('🔥 About to set isTyping to false')
    setIsTyping(false)
    console.log('🔥 handleNonStreamingResponse function completed')
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
                Huggy正在思考并可能调用工具查询信息...
              </div>
            </div>
          )}
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
