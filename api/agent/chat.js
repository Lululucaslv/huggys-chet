const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const openaiApiKey = process.env.OPENAI_API_KEY

  if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
    console.error('Missing required environment variables')
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const { tool, userId, sessionId } = req.body

    if (tool === 'generatePreSessionSummary') {
      const summary = await generatePreSessionSummary(userId, supabase, openaiApiKey)
      return res.status(200).json({ success: true, data: summary })
    }

    return res.status(400).json({ error: 'Unknown tool requested' })
  } catch (error) {
    console.error('Agent API Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function generatePreSessionSummary(userId, supabase, openaiApiKey) {
  try {
    const { data: chatMessages, error: chatError } = await supabase
      .from('chat_messages')
      .select('message, role, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (chatError) {
      throw new Error(`Failed to fetch chat messages: ${chatError.message}`)
    }

    if (!chatMessages || chatMessages.length === 0) {
      return {
        summary: '该来访者尚未进行过AI聊天对话，暂无聊天记录可供分析。',
        keyTopics: [],
        emotionalState: '未知',
        concernAreas: [],
        recommendations: ['建议在会谈开始时了解来访者的基本情况和当前关注的问题。']
      }
    }

    const conversationHistory = chatMessages
      .reverse()
      .map(msg => `${msg.role === 'user' ? '来访者' : 'AI助手'}: ${msg.message}`)
      .join('\n')

    const systemPrompt = `你是一位专业的心理咨询师助手。请基于以下来访者与AI助手的聊天记录，生成一份简洁而专业的会前摘要报告。

聊天记录：
${conversationHistory}

请以JSON格式返回分析结果，包含以下字段：
{
  "summary": "整体情况摘要（2-3句话）",
  "keyTopics": ["主要讨论话题1", "主要讨论话题2", "主要讨论话题3"],
  "emotionalState": "情绪状态评估",
  "concernAreas": ["关注领域1", "关注领域2"],
  "recommendations": ["建议1", "建议2", "建议3"]
}

请确保分析客观、专业，保护来访者隐私，避免过度解读。`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const aiResponse = await response.json()
    const summaryText = aiResponse.choices[0].message.content

    try {
      const summaryData = JSON.parse(summaryText)
      return summaryData
    } catch (parseError) {
      return {
        summary: summaryText,
        keyTopics: ['解析错误'],
        emotionalState: '需要进一步评估',
        concernAreas: ['需要进一步分析'],
        recommendations: ['建议查看原始聊天记录进行人工分析']
      }
    }

  } catch (error) {
    console.error('Error generating pre-session summary:', error)
    throw error
  }
}
