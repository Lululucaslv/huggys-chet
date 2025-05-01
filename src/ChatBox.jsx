import React, { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";

const ChatBox = ({ messages, userId }) => {
  const chatRef = useRef(null);

  // 自动滚动到底部
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={chatRef}
      className="flex-1 overflow-y-auto p-4 bg-gray-50 rounded-lg shadow-inner max-w-4xl mx-auto"
    >
      {messages.map((msg, idx) => (
        <MessageBubble
          key={`${msg.role}-${msg.time}-${idx}`}
          message={msg}
          isSelf={msg.role === "user"}
        />
      ))}
    </div>
  );
};

export default ChatBox;
