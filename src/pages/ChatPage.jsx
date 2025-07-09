import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ChatBox from '../ChatBox';
import InputArea from '../InputArea';
import '../styles/huggy-chat.css';

export default function ChatPage({ user, messages, isLoading, handleSendMessage, setBookingData }) {
  const chatBoxRef = useRef(null);
  const navigate = useNavigate();

  const handleBookingRequest = (data) => {
    setBookingData(data);
    navigate('/booking');
  };

  const welcomeMessage = messages.length === 0 && (
    <div className="huggy-welcome-message">
      <div className="huggy-avatar">🤗</div>
      <div className="huggy-message-content">
        <h2>你好！我是 Huggy AI</h2>
        <p>我是您的专属心理健康助手，随时为您提供支持和陪伴。</p>
        <div className="huggy-memory-info">
          <p>我的超能力包括：</p>
          <ul>
            <li>24/7 情感支持和倾听</li>
            <li>心理健康建议和技巧</li>
            <li>预约心理咨询师服务</li>
            <li>个性化的对话记忆</li>
          </ul>
        </div>
      </div>
    </div>
  );

  return (
    <div className="huggy-chat-page">
      <div className="huggy-animated-background">
        <div className="huggy-wave huggy-wave1"></div>
        <div className="huggy-wave huggy-wave2"></div>
        <div className="huggy-wave huggy-wave3"></div>
      </div>
      
      <div className="huggy-chat-container">
        <div className="huggy-chat-header">
          <div className="huggy-header-content">
            <div className="huggy-logo-section">
              <span className="huggy-icon">🤗</span>
              <h1>Huggy AI</h1>
            </div>
            <div className="huggy-controls">
              <div className="huggy-status-indicator">
                <div className="huggy-status-dot"></div>
                <span className="huggy-status-text">在线</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="huggy-chat-messages">
          {welcomeMessage}
          <ChatBox 
            ref={chatBoxRef}
            messages={messages} 
            isLoading={isLoading}
            user={user}
          />
        </div>
        
        <InputArea 
          onSendMessage={handleSendMessage}
          disabled={isLoading}
        />
      </div>
    </div>
  );
}
