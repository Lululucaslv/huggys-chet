import { useState } from 'react';
import { getBookingAssistance } from '../utils/api';

export default function BookingAssistant({ user, onBookingAction }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `你好 ${user?.name}！我是您的预约助手。我可以帮助您处理预约相关的问题，比如推荐心理师、选择时间或解答咨询流程。请告诉我您需要什么帮助？`
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const userMessage = { role: 'user', content: inputMessage };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);

    try {
      const response = await getBookingAssistance(inputMessage, {
        currentMessages: messages,
        userRole: user?.role
      });

      if (response.success) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: response.response
        }]);
        
        if (response.suggestions) {
          setSuggestions(response.suggestions);
        }
      }
    } catch (error) {
      console.error('Error getting booking assistance:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '抱歉，我暂时无法回应。请稍后再试或直接联系客服。'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInputMessage(suggestion);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">AI 预约助手</h3>
        <p className="text-sm text-gray-600">我来帮您处理预约相关的问题</p>
      </div>

      <div className="h-96 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-2 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="p-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-2">建议问题:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入您的问题..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows="2"
            disabled={loading}
          />
          <button
            onClick={handleSendMessage}
            disabled={loading || !inputMessage.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
