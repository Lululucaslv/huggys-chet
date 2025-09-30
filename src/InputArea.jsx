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

  return (
    <div className="flex flex-col md:flex-row items-center gap-2 p-2 bg-purple-800 text-white rounded-lg shadow mt-2">
      <textarea
        ref={inputRef}
        className="flex-1 resize-none border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        rows={1}
        placeholder="请输入消息..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={loading}
      />
      <button
        className={`px-4 py-2 rounded-lg ml-1 ${loading ? 'bg-purple-400' : 'bg-purple-600 hover:bg-purple-700'} text-white`}
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
