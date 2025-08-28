import OpenAI from 'openai'

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function respondWithPromptId(model, promptIdEnv, userContent) {
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
  })
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return resp.output_text ?? (resp.output?.[0]?.content?.[0]?.text ?? JSON.stringify(resp))
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
