export default async function handler(req, res) {
  const { method } = req;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (method) {
      case 'POST':
        return await generateSummary(req, res);
      case 'GET':
        return await getSummary(req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${method} Not Allowed` });
    }
  } catch (error) {
    console.error('Summary generator API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

const CLINICAL_SUMMARY_PROMPT = `As an expert clinical supervisor, analyze the following chat logs between a client and their AI companion. Generate a concise pre-session briefing (max 500 words) for their human therapist. The report must be structured with the following sections:

1. **Key Themes & Emotional Overview:** Summarize the client's main topics of concern and their overall emotional state during this period.
2. **Observed Patterns:** Identify any recurring cognitive patterns (e.g., catastrophizing, self-criticism) or behavioral patterns (e.g., avoidance).
3. **Positive Developments & Strengths:** Highlight any signs of progress, coping mechanisms, or personal strengths mentioned by the client.
4. **Potential Red Flags:** Note any statements regarding self-harm, hopelessness, or significant distress that require immediate attention.
5. **Suggested Focus Points:** Recommend 1-2 potential topics to explore in the upcoming session.

Chat logs to analyze:
{CHAT_LOGS}

Generate the structured summary now:`;

async function generateSummary(req, res) {
  const { userId, bookingId, lastSessionDate } = req.body;

  if (!userId || !bookingId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const chatLogs = await getChatLogsSinceLastSession(userId, lastSessionDate);
    
    if (chatLogs.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No chat logs found for this user since last session"
      });
    }

    const formattedLogs = formatChatLogsForAnalysis(chatLogs);
    
    const summary = await callOpenAIForSummary(formattedLogs);
    
    const summaryRecord = {
      id: `summary_${Date.now()}`,
      bookingId,
      userId,
      summaryText: summary,
      generatedDate: new Date(),
      chatLogsCount: chatLogs.length,
      analysisStatus: "completed"
    };

    console.log('Summary generated:', summaryRecord);

    return res.status(201).json({
      success: true,
      summaryId: summaryRecord.id,
      summary: summary,
      chatLogsAnalyzed: chatLogs.length
    });

  } catch (error) {
    console.error("Error generating session summary:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

async function getSummary(req, res) {
  const { bookingId, therapistId } = req.query;

  if (!bookingId && !therapistId) {
    return res.status(400).json({ error: 'Missing booking ID or therapist ID' });
  }

  const mockSummary = {
    id: 'summary_1',
    bookingId,
    summaryText: `
## 1. Key Themes & Emotional Overview
客户主要表达了对工作压力和人际关系的担忧，整体情绪状态显示轻度焦虑和疲惫感。

## 2. Observed Patterns
观察到客户倾向于过度思考问题，存在一定的完美主义倾向。

## 3. Positive Developments & Strengths
客户展现出良好的自我觉察能力，愿意主动寻求帮助和支持。

## 4. Potential Red Flags
无明显自伤或绝望表达，但需关注工作压力对睡眠的影响。

## 5. Suggested Focus Points
建议重点探讨压力管理技巧和工作边界设定。
    `,
    generatedDate: new Date(),
    chatLogsCount: 15
  };

  return res.status(200).json({
    success: true,
    summary: mockSummary
  });
}

async function getChatLogsSinceLastSession(userId, lastSessionDate) {
  const mockLogs = [
    {
      userId,
      timestamp: new Date(Date.now() - 3600000),
      message: '我最近工作压力很大，经常加班到很晚',
      sender: 'USER'
    },
    {
      userId,
      timestamp: new Date(Date.now() - 3500000),
      message: '工作压力确实会影响我们的身心健康。你能具体说说是什么让你感到压力吗？',
      sender: 'AI'
    }
  ];

  if (lastSessionDate) {
    return mockLogs.filter(log => new Date(log.timestamp) > new Date(lastSessionDate));
  }

  return mockLogs;
}

function formatChatLogsForAnalysis(chatLogs) {
  return chatLogs.map(log => {
    const timestamp = new Date(log.timestamp).toLocaleString();
    const sender = log.sender === "USER" ? "Client" : "AI Companion";
    return `[${timestamp}] ${sender}: ${log.message}`;
  }).join('\n\n');
}

async function callOpenAIForSummary(formattedLogs) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }
  
  const prompt = CLINICAL_SUMMARY_PROMPT.replace("{CHAT_LOGS}", formattedLogs);
  
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert clinical supervisor providing pre-session briefings for therapists. Generate structured, professional, and actionable summaries."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 800,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
