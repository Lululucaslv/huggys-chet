import OpenAI from 'openai'

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function respondWithPromptId(model, promptIdEnv, userContent, opts = {}) {
  const promptId = process.env[promptIdEnv]
  if (!promptId) throw new Error(`Missing ${promptIdEnv}`)
  const input = [
    {
      role: 'user',
      content:
        typeof userContent === 'string'
          ? userContent
          : JSON.stringify(userContent),
    },
  ]
  const resp = await openai.responses.create({
    model,
    prompt: { id: promptId },
    input,
    max_output_tokens: typeof opts.max_output_tokens === 'number' ? opts.max_output_tokens : 1024,
  })
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return resp.output_text ?? (resp.output?.[0]?.content?.[0]?.text ?? JSON.stringify(resp))
export async function respondWithPromptIdTimed(model, promptIdEnv, userContent, timeoutMs = 12000, opts = {}) {
  const promptId = process.env[promptIdEnv]
  if (!promptId) throw new Error(`Missing ${promptIdEnv}`)
  const input = [
    {
      role: 'user',
      content: typeof userContent === 'string' ? userContent : JSON.stringify(userContent),
    },
  ]
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs))
  try {
    const resp = await openai.responses.create(
      {
        model,
        prompt: { id: promptId },
        input,
        max_output_tokens: typeof opts.max_output_tokens === 'number' ? opts.max_output_tokens : 1024,
      },
      { signal: controller.signal }
    )
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return resp.output_text ?? (resp.output?.[0]?.content?.[0]?.text ?? JSON.stringify(resp))
  } finally {
    clearTimeout(timer)
  }
}
}

export async function fallbackChatCompletion(model, systemEnv, userContent) {
  const system = process.env[systemEnv] || 'You are a helpful assistant.'
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: String(userContent) },
    ],
  })
  return completion.choices?.[0]?.message?.content ?? ''
}
