import { useState, useEffect, useRef } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { ChatAPI } from '../lib/chatApi'
import { UserProfileUpdater } from '../lib/userProfileUpdater'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Send, Loader2, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

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
        await handleStreamingResponse(response)
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setIsTyping(false)
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated Background Waves */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-purple-900/30 to-pink-900/20"></div>
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full animate-spin-slow"></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-l from-purple-500/10 to-pink-500/10 rounded-full animate-spin-slow animation-delay-2000"></div>
      </div>

      {/* Header */}
      <header className="relative bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-sm border-b border-blue-400/30 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link 
                to="/" 
                className="flex items-center gap-2 text-blue-300 hover:text-blue-200 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="text-sm font-medium">返回主页</span>
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center animate-pulse">
                  <span className="text-white text-lg">🤗</span>
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                  Huggy AI 心理咨询
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-blue-200">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>在线</span>
              </div>
              <span className="text-sm text-blue-300">
                {session.user.email}
              </span>
              <button
                onClick={() => supabase.auth.signOut()}
                className="text-blue-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Container */}
      <main className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-500/20 h-[calc(100vh-140px)] flex flex-col overflow-hidden">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 && (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                  <span className="text-3xl">🤗</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  欢迎来到 Huggy AI
                </h3>
                <p className="text-blue-200 max-w-md mx-auto leading-relaxed">
                  我是您的专属AI心理咨询伙伴，随时准备倾听您的想法和感受。请随意开始我们的对话吧！
                </p>
              </div>
            )}
            
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
                    <span className="text-white text-sm">🤗</span>
                  </div>
                )}
                <div
                  className={`max-w-[75%] px-6 py-4 rounded-2xl backdrop-blur-sm ${
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-blue-600/80 to-purple-600/80 text-white rounded-br-md border border-blue-400/30'
                      : 'bg-slate-700/60 text-blue-50 rounded-bl-md border border-slate-600/50'
                  }`}
                  style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                  }}
                >
                  {message.content}
                </div>
                {message.role === 'user' && (
                  <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm">👤</span>
                  </div>
                )}
              </div>
            ))}
            
            {isTyping && (
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 animate-spin">
                  <span className="text-white text-sm">🤗</span>
                </div>
                <div className="bg-slate-700/60 backdrop-blur-sm px-6 py-4 rounded-2xl rounded-bl-md border border-slate-600/50 flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  <span className="text-blue-200">Huggy 正在思考中...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input Area */}
          <div className="border-t border-slate-600/50 bg-slate-800/60 backdrop-blur-sm p-6">
            <div className="flex gap-4">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="在这里输入您的想法和感受..."
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                disabled={isTyping}
                className="flex-1 bg-slate-700/50 border-slate-600/50 text-white placeholder-slate-400 rounded-2xl px-6 py-4 focus:border-blue-400/50 focus:ring-blue-400/20 backdrop-blur-sm"
                style={{
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                }}
              />
              <Button 
                onClick={sendMessage} 
                disabled={isTyping || !inputMessage.trim()}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-2xl px-8 py-4 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
