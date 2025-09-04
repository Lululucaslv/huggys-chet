import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function logAILine(scope, entry = {}) {
  try {
    await supabase.from("ai_logs").insert({
      scope,
      ok: entry.ok ?? false,
      model: entry.model ?? "gpt-4o",
      prompt_id: entry.promptId ?? process.env.OPENAI_SYSTEM_PROMPT_ID,
      payload:
        typeof entry.payload === "string"
          ? entry.payload
          : entry.payload
          ? JSON.stringify(entry.payload)
          : null,
      output:
        typeof entry.output === "string"
          ? entry.output
          : entry.output
          ? JSON.stringify(entry.output)
          : null,
      error: entry.error ? String(entry.error) : null,
    });
  } catch (_) {}
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { userMessage, userId, therapistCode, browserTz } = req.body || {};
    if (!userMessage || !userId) {
      res.status(400).json({ error: "userMessage and userId required" });
      return;
    }

    const code = therapistCode || "THERAPIST_TEST_CODE";
    const nowISO = new Date().toISOString();
    const in36hISO = new Date(Date.now() + 36 * 3600 * 1000).toISOString();

    const { data: slots, error: availErr } = await supabase
      .from("therapist_availability")
      .select("id, start_utc, end_utc")
      .eq("therapist_code", code)
      .eq("status", "open")
      .gt("start_utc", nowISO)
      .lt("start_utc", in36hISO)
      .order("start_utc", { ascending: true });

    if (availErr) console.error("availability query error:", availErr?.message);

    const availability = (slots || []).slice(0, 6).map((s) => ({
      id: s.id,
      startUTC: s.start_utc,
      endUTC: s.end_utc,
    }));

    const payload = {
      message: userMessage,
      context: {
        browserTz: browserTz || "UTC",
        therapistCode: code,
        availability,
      },
    };

    const resp = await openai.responses.create(
      {
        model: "gpt-4o",
        prompt: { id: process.env.OPENAI_SYSTEM_PROMPT_ID },
        input: [{ role: "user", content: JSON.stringify(payload) }],
      },
      { timeout: 12000 }
    );

    const text =
      resp.output_text ??
      (resp.output?.[0]?.content?.[0]?.text ?? "");

    await logAILine("chat", {
      ok: true,
      model: "gpt-4o",
      promptId: process.env.OPENAI_SYSTEM_PROMPT_ID,
      payload,
      output: text,
    });

    const { error: chatErr } = await supabase.from("chats").insert({
      booking_id: null,
      user_id: userId,
      role: "user",
      content: String(userMessage),
    });
    if (chatErr) console.warn("chats insert error:", chatErr?.message);

    res.status(200).json({ text });
  } catch (err) {
    const fallback =
      "抱歉，查询有点慢。我先给你两种选择：\n" +
      "1) 换一个时间范围（例如“本周末下午”），我再查一次；\n" +
      "2) 告诉我偏好的咨询师或时区，我用这个条件来筛选。";

    await logAILine("chat", {
      ok: false,
      model: "gpt-4o",
      promptId: process.env.OPENAI_SYSTEM_PROMPT_ID,
      error: err?.message,
    });

    res.status(200).json({ text: fallback, fallback: true });
  }
}
