// 请求：使用咨询师端 Prompt ID，限制输出长度
const resp = await openai.responses.create(
  {
    model: "gpt-5",
    prompt: { id: process.env.OPENAI_SYSTEM_PROMPT_THERAPIST_ID },
    input: [{ role: "user", content: JSON.stringify(payload) }],
    max_output_tokens: 1200
  },
  { timeout: 15000 }
);

const text = resp.output_text ?? (resp.output?.[0]?.content?.[0]?.text ?? "");

let summary;
try {
  summary = JSON.parse(text);
} catch {
  summary = {
    type: "SESSION_SUMMARY",
    bookingId: booking.id,
    therapistCode: booking.therapist_code,
    clientName: "",
    sessionTimeUTC: booking.start_utc,
    sessionTimeDisplayTZ: "UTC",
    concerns: [],
    riskSignals: [],
    goals: [],
    suggestedQuestions: [],
    copingStrategies: []
  };
}

// 记录日志（成功）
await supabase.from("ai_logs").insert({
  scope: "summary",
  ok: true,
  model: "gpt-5",
  prompt_id: process.env.OPENAI_SYSTEM_PROMPT_THERAPIST_ID,
  payload: JSON.stringify(payload),
  output: JSON.stringify(summary)
});

return res.status(200).json({ summary });
