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
      className="flex-1 overflow-y-auto rounded-3xl border border-cyan-300/20 bg-white/5 p-4 shadow-[0_0_35px_rgba(6,182,212,0.2)] backdrop-blur-xl transition-all duration-300 md:p-6"
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
