import React from "react";

const MessageBubble = ({ message, isSelf }) => {
  if (!message) return null;

  const containerClass = `flex mb-3 ${isSelf ? "justify-end" : "justify-start"}`;
  const bubbleClass = `max-w-xs md:max-w-md break-words rounded-2xl px-4 py-2 shadow ${
    isSelf
      ? "bg-blue-500 text-white rounded-br-none"
      : "bg-white text-gray-900 rounded-bl-none"
  }`;

  return (
    <div className={containerClass}>
      {!isSelf && (
        <img
          src={message.avatar || "/ai-avatar.png"}
          alt="AI头像"
          className="w-8 h-8 rounded-full mr-2 self-end"
        />
      )}
      <div className={bubbleClass}>
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
        <div className="text-xs text-gray-400 mt-1 text-right">{message.time}</div>
      </div>
      {isSelf && (
        <img
          src={message.avatar || "/user-avatar.png"}
          alt="用户头像"
          className="w-8 h-8 rounded-full ml-2 self-end"
        />
      )}
    </div>
  );
};

export default MessageBubble;
