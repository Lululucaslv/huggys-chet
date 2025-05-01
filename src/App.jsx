import React, { useState, useCallback } from "react";
import ChatBox from "./ChatBox";
import InputArea from "./InputArea";
import AudioPlayer from "./AudioPlayer";
import { sendChat } from "./utils/api";
import { getUserIdFromUrl } from "./utils/user";

const App = () => {
  const userId = getUserIdFromUrl();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  // 时间格式化函数
  const getCurrentTime = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // 处理消息发送
  const handleSend = useCallback(async () => {
    if (loading || (!input && !imagePreview)) return;

    const time = getCurrentTime();
    const newMsg = {
      role: "user",
      content: input,
      imageBase64: imagePreview,
      time,
    };

    setMessages((prev) => [...prev, newMsg]);
    setInput("");
    setImagePreview(null);
    setLoading(true);

    try {
      const res = await sendChat({ userId, messages: [...messages, newMsg] });

      const reply = res?.reply;
      if (reply && reply.content) {
        setMessages((prev) => [
          ...prev,
          { ...reply, time: getCurrentTime() },
        ]);
        setPlaying(true);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "AI 未能返回有效内容，请稍后再试。",
            time: getCurrentTime(),
          },
        ]);
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "网络错误，请稍后重试。",
          time: getCurrentTime(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, imagePreview, messages, userId, loading]);

  return (
    <div className="flex flex-col h-screen max-h-screen bg-gray-100">
      <ChatBox messages={messages} userId={userId} />
      <InputArea
        input={input}
        setInput={setInput}
        onSend={handleSend}
        onImage={setImagePreview}
        imagePreview={imagePreview}
        onRemoveImage={() => setImagePreview(null)}
        onVoice={setInput}
        loading={loading}
      />
      {messages.length > 0 &&
        messages[messages.length - 1].role === "assistant" && (
          <AudioPlayer
            text={messages[messages.length - 1].content}
            play={playing}
          />
        )}
    </div>
  );
};

export default App;
