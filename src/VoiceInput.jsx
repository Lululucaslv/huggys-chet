import React, { useState, useEffect, useRef } from "react";

const VoiceInput = ({ onVoice, setInput, inputRef }) => {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (window.SpeechRecognition || window.webkitSpeechRecognition) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recog = new SR();
      recog.lang = "zh-CN";
      recog.continuous = false;
      recog.interimResults = false;
      recognitionRef.current = recog;
    }
  }, []);

  const handleVoice = () => {
    const recog = recognitionRef.current;
    if (!recog) {
      alert("当前浏览器不支持语音识别");
      return;
    }

    setListening(true);
    recog.start();

    recog.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      if (onVoice) onVoice(transcript);
      if (inputRef?.current) inputRef.current.focus();
      setListening(false);
    };

    recog.onerror = (e) => {
      console.error("语音识别失败", e);
      setListening(false);
    };

    recog.onend = () => {
      setListening(false);
    };
  };

  return (
    <button
      type="button"
      className={`ml-1 flex items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-lg transition-all duration-300 ${
        listening
          ? "bg-emerald-400/30 text-emerald-100 shadow-[0_0_25px_rgba(16,185,129,0.45)]"
          : "bg-white/10 text-cyan-200 hover:border-cyan-200/60 hover:shadow-[0_0_25px_rgba(56,189,248,0.35)]"
      }`}
      onClick={handleVoice}
      title="语音输入"
    >
      🎤
    </button>
  );
};

export default VoiceInput;
