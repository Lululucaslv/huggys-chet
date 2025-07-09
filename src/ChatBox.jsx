import React, { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";

const ChatBox = ({ messages, isLoading, user }) => {
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <>
      {messages.map((msg, idx) => (
        <MessageBubble
          key={`${msg.role}-${msg.time}-${idx}`}
          message={msg}
          isSelf={msg.role === "user"}
          user={user}
        />
      ))}
      {isLoading && (
        <div className="huggy-typing-indicator">
          <div className="huggy-avatar">🤗</div>
          <div className="huggy-typing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatBox;
