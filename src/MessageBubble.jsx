import React from "react";

const MessageBubble = ({ message, isSelf, user }) => {
  if (!message) return null;

  const isUser = isSelf;
  const bubbleClass = `huggy-message-bubble ${isUser ? 'user' : ''}`;

  return (
    <div className={bubbleClass}>
      {!isUser && (
        <div className="huggy-avatar">
          {message.avatar ? (
            <img src={message.avatar} alt="AI头像" />
          ) : (
            '🤗'
          )}
        </div>
      )}
      <div className="huggy-message-text">
        {message.imageBase64 && (
          <img
            src={message.imageBase64}
            alt="图片消息"
            loading="lazy"
            className="mb-1 max-w-full rounded-lg cursor-pointer"
            onClick={() => window.open(message.imageBase64, "_blank")}
          />
        )}
        {message.content && <span>{message.content}</span>}
        {message.time && <div className="huggy-message-time">{message.time}</div>}
      </div>
      {isUser && (
        <div className="huggy-user-avatar">
          {message.avatar ? (
            <img src={message.avatar} alt="用户头像" />
          ) : (
            user?.name?.charAt(0) || '用'
          )}
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
