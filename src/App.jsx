import { useState, useRef, useEffect } from 'react'
import ChatBox from './ChatBox'
import InputArea from './InputArea'
import BookingForm from './components/BookingForm'
import TherapistDashboard from './components/TherapistDashboard'
import AuthForm from './components/AuthForm'
import { sendMessage, logChatMessage } from './utils/api'
import './index.css'

function App() {
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentView, setCurrentView] = useState('chat')
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [bookingData, setBookingData] = useState(null)
  const chatBoxRef = useRef(null)

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    
    if (token && userData) {
      try {
        const response = await fetch('/api/auth', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_data');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
      }
    }
    
    setAuthLoading(false);
  };

  const handleAuthSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    setUser(null);
    setCurrentView('chat');
  };

  const handleSendMessage = async (content, isVision = false) => {
    const userMessage = { role: 'user', content }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setIsLoading(true)

    try {
      await logChatMessage(content, 'USER', user?.id || 'anonymous')
    } catch (error) {
      console.error('Error logging user message:', error)
    }

    try {
      const response = await sendMessage(newMessages, isVision)
      
      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      
      const assistantMessage = { role: 'assistant', content: '' }
      setMessages(prev => [...prev, assistantMessage])

      let assistantContent = ''
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          if (assistantContent.trim()) {
            try {
              await logChatMessage(assistantContent.trim(), 'AI', user?.id || 'anonymous')
            } catch (error) {
              console.error('Error logging AI message:', error);
            }
          }
          break;
        }
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            
            if (data === '[DONE]') {
              setIsLoading(false)
              return
            }
            
            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content
              
              if (content) {
                assistantContent += content
                setMessages(prev => {
                  const newMessages = [...prev]
                  newMessages[newMessages.length - 1] = {
                    role: 'assistant',
                    content: assistantContent
                  }
                  return newMessages
                })
              }
            } catch (e) {
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '抱歉，发生了一些错误。请稍后再试。' 
      }])
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm onAuthSuccess={handleAuthSuccess} />;
  }

  const renderNavigation = () => (
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex space-x-8">
            {user.role === 'THERAPIST' && (
              <>
                <button
                  onClick={() => setCurrentView('chat')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    currentView === 'chat'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  AI 聊天
                </button>
                <button
                  onClick={() => setCurrentView('therapist')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    currentView === 'therapist'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  工作台
                </button>
              </>
            )}
            {user.role === 'CLIENT' && (
              <h1 className="text-xl font-semibold text-gray-800">More Than Hugs - 心理咨询平台</h1>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {user.name} ({user.role === 'CLIENT' ? '来访者' : '心理师'})
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-red-600 hover:text-red-800"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (user.role === 'THERAPIST') {
      switch (currentView) {
        case 'therapist':
          return <TherapistDashboard user={user} />;
        default:
          return (
            <div className="chat-container">
              <ChatBox 
                ref={chatBoxRef}
                messages={messages} 
                isLoading={isLoading}
              />
              <InputArea 
                onSendMessage={handleSendMessage}
                disabled={isLoading}
              />
            </div>
          );
      }
    } else {
      return (
        <div className="flex h-screen">
          <div className="w-1/2 border-r border-gray-200">
            <div className="p-4 bg-gray-50 border-b">
              <h2 className="text-lg font-semibold">AI 聊天助手</h2>
            </div>
            <div className="chat-container h-full">
              <ChatBox 
                ref={chatBoxRef}
                messages={messages} 
                isLoading={isLoading}
              />
              <InputArea 
                onSendMessage={handleSendMessage}
                disabled={isLoading}
                onBookingRequest={(data) => setBookingData(data)}
              />
            </div>
          </div>
          <div className="w-1/2">
            <div className="p-4 bg-gray-50 border-b">
              <h2 className="text-lg font-semibold">预约咨询</h2>
            </div>
            <BookingForm 
              user={user} 
              onBookingCreated={() => setCurrentView('chat')}
              bookingData={bookingData}
              onBookingDataChange={setBookingData}
            />
          </div>
        </div>
      );
    }
  };

  return (
    <div className="app">
      {renderNavigation()}
      {renderContent()}
    </div>
  )
}

export default App
