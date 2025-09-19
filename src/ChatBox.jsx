import React, { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";

const ChatBox = ({ messages, userId, therapistCode, onBooked }) => {
  const chatRef = useRef(null);

  // 新消息滚动到底
  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div
      ref={chatRef}
      className="flex-1 overflow-y-auto p-4 bg-gray-50 rounded-lg shadow-inner max-w-4xl mx-auto"
    >
      {messages.map((msg, idx) => (
        <MessageBubble
          key={`${msg.role}-${msg.time || idx}-${idx}`}
          message={msg}
          isSelf={msg.role === "user"}
          // 关键：把这三项透传给 MessageBubble，让它能渲染/创建预约
          userId={userId}
          therapistCode={therapistCode}
          onBooked={onBooked}
        />
      ))}
    </div>
  );
};

export default ChatBox;
