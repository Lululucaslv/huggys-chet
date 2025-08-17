
interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  image?: string
}

interface UserProfile {
  id?: string
  total_messages: number
  personality_type: string
  preferences: string[]
  timezone: string
}

export class ChatAPI {
  private apiKey: string
  
  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY || ''
    if (!this.apiKey) {
      console.error('VITE_OPENAI_API_KEY not found in environment variables')
      console.log('Available env vars:', Object.keys(import.meta.env))
    } else {
      console.log('OpenAI API key loaded successfully')
    }
  }

  async sendMessage(
    messages: ChatMessage[], 
    userProfile: UserProfile,
    stream: boolean = false
  ): Promise<Response> {
    try {
      const userMessage = messages[messages.length - 1]?.content || ''
      const conversationHistory = messages.slice(0, -1)

      console.log('Calling AI Agent API with:', {
        tool: 'chatWithTools',
        messagesCount: conversationHistory.length,
        userMessage: userMessage.substring(0, 50) + '...',
        userId: userProfile.id || 'anonymous'
      })

      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: 'chatWithTools',
          messages: conversationHistory,
          userMessage: userMessage,
          userId: userProfile.id || 'anonymous'
        })
      })

      console.log('AI Agent API response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Agent API Error:', response.status, response.statusText)
        console.error('Error response body:', errorText)
        throw new Error(`Agent API request failed: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      console.log('AI Agent API result:', result)
      
      if (result.success && result.data && result.data.message) {
        console.log('AI Agent response successful, returning message:', result.data.message.substring(0, 100) + '...')
        const responseData = JSON.stringify(result)
        const mockResponse = new Response(responseData, {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
        return mockResponse
      } else {
        console.error('Invalid AI Agent response structure:', result)
        throw new Error('Invalid response from agent API')
      }

    } catch (error) {
      console.error('Error in sendMessage:', error)
      
      const systemPrompt = this.buildSystemPrompt(userProfile)
      const fullMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...messages
      ]

      const fallbackResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo',
          messages: fullMessages,
          temperature: 0.85,
          max_tokens: 2000,
          stream: stream
        })
      })

      if (!fallbackResponse.ok) {
        const errorText = await fallbackResponse.text()
        console.error('OpenAI API Error:', fallbackResponse.status, fallbackResponse.statusText)
        console.error('Error response body:', errorText)
        throw new Error(`OpenAI API request failed: ${fallbackResponse.status} - ${errorText}`)
      }

      return fallbackResponse
    }
  }

  private buildSystemPrompt(userProfile: UserProfile): string {
    const systemPromptContent = import.meta.env.VITE_OPENAI_SYSTEM_PROMPT || `你是Huggy AI，一个专业而温暖的AI心理咨询伙伴。你具有以下特殊能力：

🧠 **记忆与成长能力**：
- 你能完整记住与每个用户的所有对话历史
- 你会根据用户的交流方式和内容逐渐调整自己的回复风格
- 你是一个"养成系"AI，会随着互动变得更了解用户

💝 **个性化服务**：
- 你会识别用户的情感状态和需求
- 你会根据用户的字符数调整回复长度，保持相近的交流节奏
- 你会适时引导新话题，但不会过于主动

🎯 **专业心理支持**：
- 你提供专业的心理咨询建议，但以朋友的方式表达
- 你善于倾听，给予共情和理解
- 你会帮助用户探索内心感受，提供积极的心理支持`

    const basePrompt = systemPromptContent

    if (userProfile.total_messages > 0) {
      return basePrompt + `

👤 **用户档案**：
- 我们已经进行了 ${userProfile.total_messages} 次对话
- 用户性格特点：${userProfile.personality_type}
- 用户关注领域：${userProfile.preferences.join(', ') || '正在了解中'}

请基于这些信息提供个性化的回复。`
    }
    
    return basePrompt + `

这是我们的第一次对话。请温暖地介绍自己，说明你的记忆和成长能力，让用户感到安心和期待。`
  }
}
