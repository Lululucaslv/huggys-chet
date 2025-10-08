import React, { useRef } from "react";
import ImageUploader from "./ImageUploader";
import VoiceInput from "./VoiceInput";

const InputArea = ({
  input,
  setInput,
  onSend,
  onImage,
  onVoice,
  imagePreview,
  onRemoveImage,
  loading,
}) => {
  const inputRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const sendButtonClass = loading
    ? "px-5 py-2.5 rounded-xl bg-slate-500/50 text-slate-300 cursor-not-allowed"
    : "relative overflow-hidden px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-fuchsia-500 text-white shadow-[0_0_25px_rgba(56,189,248,0.35)] transition-all duration-300 hover:shadow-[0_0_35px_rgba(147,197,253,0.55)] focus:outline-none focus:ring-2 focus:ring-cyan-300/60";

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-3 shadow-[0_0_45px_rgba(15,118,110,0.25)] backdrop-blur-xl md:flex-row md:items-center md:p-4">
      <textarea
        ref={inputRef}
        className="flex-1 resize-none rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-cyan-300/70 focus:shadow-[0_0_25px_rgba(56,189,248,0.3)]"
        rows={1}
        placeholder="请输入消息..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={loading}
      />
      <button
        className={`${sendButtonClass} md:ml-1`}
        onClick={onSend}
        disabled={loading}
      >
        {loading ? "发送中..." : "发送"}
      </button>
      <ImageUploader
        onImage={onImage}
        imagePreview={imagePreview}
        onRemoveImage={onRemoveImage}
      />
      <VoiceInput
        onVoice={onVoice}
        setInput={setInput}
        inputRef={inputRef}
      />
    </div>
  );
};

export default InputArea;
