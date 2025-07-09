import { useState, useRef } from 'react'

export default function InputArea({ onSendMessage, disabled }) {
  const [message, setMessage] = useState('')
  const [isVision, setIsVision] = useState(false)
  const fileInputRef = useRef(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (message.trim() && !disabled) {
      onSendMessage(message, isVision)
      setMessage('')
      setIsVision(false)
    }
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64 = e.target.result
        setMessage(base64)
        setIsVision(true)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="huggy-chat-input-container">
      <form onSubmit={handleSubmit}>
        <div className="huggy-input-wrapper">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="huggy-image-upload-btn"
          >
            📷
          </button>
          
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="输入您的消息..."
            className="huggy-message-input"
            rows="1"
            disabled={disabled}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
          />
          
          <button
            type="submit"
            disabled={disabled || !message.trim()}
            className="huggy-send-button"
          >
            ➤
          </button>
        </div>
      </form>
      
      <div className="huggy-input-footer">
        <div className="huggy-privacy-note">
          <span>🔒</span>
          <span>安全加密对话</span>
        </div>
        <div className="huggy-char-count">
          {message.length}/2000
        </div>
      </div>
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        className="hidden"
      />
      
      {isVision && (
        <div className="huggy-image-preview">
          图片已上传，将进行视觉分析
        </div>
      )}
    </div>
  )
}
