// public/api/chat.js
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const DEFAULT_CODE = process.env.THERAPIST_DEFAULT_CODE || "8W79AL2B";

// 预约意图判定（中英文）
function isBookingIntent(text = "") {
  const t = String(text).toLowerCase();
  const zh = /(预约|约个?时间|时间(段|点)|安排|可用|空闲|什么时候|哪天|几点|明天|后天|周[一二三四五六日天]|上午|下午|晚上)/;
  const en = /(book|booking|schedule|when can|available|availability|time slot|reschedule|slot)/;
  return zh.test(t) || en.test(t);
}

// 名字 -> 代码，便于“我想约Megan”
function normalizeTherapistFromText(text = "") {
  const t = String(text).toLowerCase();
  const map = {
    "megan chang": "8W79AL2B",
    "megan": "8W79AL2B",
    "hanqi lyu": "8W79AL2B",
    "hanqi": "8W79AL2B"
  };
  for (const k of Object.keys(map)) if (t.includes(k)) return map[k];
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { userMessage, userId, therapistCode, browserTz = "UTC", lang = "zh-CN" } = req.body || {};
  if (!userMessage || !userId) {
    const msg = "请告诉我你的情况，或说一个你方便的时间范围（例如：明天下午）。";
    return res.status(200).json(compat(msg, []));
  }

  try {
    if (isBookingIntent(userMessage)) {
      // 72h 内可用时段
      const code = therapistCode || normalizeTherapistFromText(userMessage) || DEFAULT_CODE;
      const nowISO = new Date().toISOString();
      const in72hISO = new Date(Date.now() + 72 * 3600 * 1000).toISOString();

      const { data: slots } = await supabase
        .from("therapist_availability")
        .select("id, therapist_code, start_utc, end_utc")
        .eq("status", "open")
        .eq("therapist_code", code)
        .gt("start_utc", nowISO)
        .lt("start_utc", in72hISO)
        .order("start_utc", { ascending: true })
        .limit(8);

      const options = (slots || []).map(s => ({
        availabilityId: s.id,
        therapistCode: s.therapist_code || code,
        startUTC: s.start_utc,
        endUTC: s.end_utc
      }));

      if (options.length) {
        const text = lang.startsWith("zh")
          ? `已为您找到 ${options.length} 个可预约时间，请选择：`
          : `I found ${options.length} available time slots. Please pick one:`;
        return res.status(200).json(compat(text, [{ type: "TIME_CONFIRM", options }]));
      }

      const noSlot = lang.startsWith("zh")
        ? "当前时段暂不可约。您可以换一个时间范围（例如“这周末下午”），我再帮你查看。"
        : "No open slots right now. Please share another time window and I’ll check again.";
      return res.status(200).json(compat(noSlot, []));
    }

    // 普通共情聊天：用你的 Prompt ID（Responses API）
    const payload = { message: userMessage, context: { browserTz, lang } };
    try {
      const resp = await openai.responses.create(
        { model: "gpt-4o", prompt: { id: process.env.OPENAI_SYSTEM_PROMPT_ID }, input: [{ role: "user", content: JSON.stringify(payload) }] },
        { timeout: 12000 }
      );
      const text = resp.output_text ?? (resp.output?.[0]?.content?.[0]?.text ?? "");
      return res.status(200).json(compat(text, []));
    } catch {
      const fallback = lang.startsWith("zh")
        ? "我在这，先陪你说说发生了什么吧。如果你愿意，我们也可以在合适的时候安排一次专业咨询。"
        : "I’m here with you. Tell me what’s going on.";
      return res.status(200).json(compat(fallback, []));
    }
  } catch {
    return res.status(200).json(compat("抱歉，系统有点忙。请稍后再试。", []));
  }
}

// —— 与旧前端兼容的响应打包器 ——
// 旧：{ reply: { role:'assistant', content: "..." } }
// 新：{ success, content, toolResults }
function compat(text, toolResults) {
  return {
    success: true,
    content: text,
    toolResults,
    reply: { role: "assistant", content: text }, // 兼容旧前端
    blocks: toolResults,                           // 兼容旧字段名
    response: text                                 // 兼容最老的 data.response
  };
}
