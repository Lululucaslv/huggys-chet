import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ChatBox from '../ChatBox';
import InputArea from '../InputArea';

export default function ChatPage({ user, messages, isLoading, handleSendMessage, setBookingData }) {
  const chatBoxRef = useRef(null);
  const navigate = useNavigate();

  const handleBookingRequest = (data) => {
    setBookingData(data);
    navigate('/booking');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 bg-gray-50 border-b">
        <h2 className="text-lg font-semibold">AI 聊天助手</h2>
      </div>
      <div className="flex-1 flex flex-col">
        <ChatBox 
          ref={chatBoxRef}
          messages={messages} 
          isLoading={isLoading}
        />
        <InputArea 
          onSendMessage={handleSendMessage}
          disabled={isLoading}
          onBookingRequest={handleBookingRequest}
        />
      </div>
    </div>
  );
}
