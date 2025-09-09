// src/App.jsx
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

  // 本地时间显示
  const getCurrentTime = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // 预约成功回调：清掉上一条助手消息中的 TIME_CONFIRM，并追加成功提示
  const handleBooked = useCallback((booking) => {
    setMessages((prev) => {
      const next = [...prev];
      // 清除最近一条助手消息里的 chips（如果存在）
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i]?.role === "assistant") {
          next[i] = { ...next[i], toolResults: [] };
          break;
        }
      }
      // 追加成功提示
      next.push({
        role: "assistant",
        content: `预约成功！时间：${new Date(booking.start_utc).toLocaleString()}`,
        time: getCurrentTime(),
        toolResults: [],
      });
      return next;
    });
    setPlaying(true);
  }, []);

  // 发送消息
  const handleSend = useCallback(async () => {
    if (loading || (!input && !imagePreview)) return;

    const time = getCurrentTime();
    const newMsg = {
      role: "user",
      content: input || "",
      imageBase64: imagePreview || null,
      time,
    };

    setMessages((prev) => [...prev, newMsg]);
    setInput("");
    setImagePreview(null);
    setLoading(true);

    try {
      const browserTz =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

      // 对齐 /api/chat 的入参与返回
      const res = await sendChat({
        userMessage: newMsg.content,
        userId,
        therapistCode: undefined, // 可不传，服务端有 THERAPIST_DEFAULT_CODE 兜底
        browserTz,
      });

      const aiText =
        typeof res?.content === "string" && res.content.trim().length > 0
          ? res.content
          : "我在这，先陪你聊聊。";

      const toolResults = Array.isArray(res?.toolResults)
        ? res.toolResults
        : [];

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: aiText,
          toolResults, // MessageBubble 会据此渲染 TIME_CONFIRM 按钮
          time: getCurrentTime(),
        },
      ]);

      setPlaying(true);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "网络异常或服务繁忙，请稍后再试。",
          time: getCurrentTime(),
          toolResults: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading, input, imagePreview, userId]);

  return (
    <div className="flex flex-col h-screen max-h-screen bg-gray-100">
      <ChatBox
        messages={messages}
        userId={userId}
        // therapistCode 可选；不传走默认 8W79AL2B
        onBooked={handleBooked}
      />

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
            text={messages[messages.length - 1].content || ""}
            play={playing}
          />
        )}
    </div>
  );
};

export default App;
