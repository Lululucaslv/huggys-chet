import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(url, key, { auth: { persistSession: false } });
}

const DEFAULT_CODE = process.env.THERAPIST_DEFAULT_CODE || "8W79AL2B";

const SYSTEM_PROMPT_USER = `
你是 Huggy，一位高共情的AI陪伴师。你的核心使命：让来访者感到“被听见、不孤单”。
沟通原则：
1) 无条件积极关注：接纳、无评判；禁止说教/诊断/医疗建议。
2) 准确共情：先情绪验证（validating），再用简短复述/反映（reflect/paraphrase）。
3) 真诚透明：可适度使用“我…”句式（如“我听到你说…我能感到…”）。
4) 以用户为中心：少谈自己，围绕用户当下体验与需要。
5) 此时此地：回应此刻情绪；若出现自伤/他伤等风险，温和提示尽快寻求线下专业支持与求助热线。
对话风格：
- 2–4 句一轮，语气温柔自然，尽量简洁，可少量表情🙂；
- 多用开放式问题（什么/如何/哪一刻），避免“你应该…”；
- 仅在用户明确提出预约时交由业务流程处理，否则坚持情感陪伴。
输出：自然中文短段落；非必要不列清单。
`;

function isBookingIntent(text = "") {
  const t = String(text).toLowerCase();
  const zhBook = /(预约|约个?|安排|改约|改期|再约|可预约|可用|可用时间|空档|空闲|空余|空位|时段|看.*时段|时间安排|排期)/;
  const zhTime = /(时间(段|点)?|今天|明天|后天|这周|下周|周[一二三四五六日天]|上午|下午|晚上|\d{1,2}点|\d{1,2}:\d{2}|(\d{1,3})\s*小时|(\d{1,3})h)/;
  const enBook = /\b(book|booking|schedule|reschedule|slot|availability|available)\b/;
  const enTime = /\b(today|tomorrow|tonight|this week|next week|morning|afternoon|evening|am|pm|\d{1,2}(:\d{2})?\s?(am|pm)?|\d{1,3}\s?hours?)\b/;
  const strong = /(预约|booking|安排时间|排期)/.test(t);
  const normal = (zhBook.test(t) && zhTime.test(t)) || (enBook.test(t) && enTime.test(t));
  return strong || normal;
}

function normTokens(raw) {
  const t = String(raw || '').toLowerCase()
  return Array.from(new Set(t.split(/[^a-z\u4e00-\u9fa5]+/).filter(Boolean)))
}

async function resolveTherapistFromText(text) {
  const supabase = getSupabase();
  const raw = String(text || "").toLowerCase().trim();
  if (!raw) return null;

  const terms = normTokens(raw);

  const aliasCandidates = [...terms, raw];
  for (const term of aliasCandidates) {
    const { data: byAlias } = await supabase
      .from("therapists")
      .select("code,name,aliases,active")
      .contains("aliases", [term])
      .eq("active", true)
      .limit(1);
    if (byAlias?.length) return byAlias[0];
  }

  for (const t of terms) {
    const { data } = await supabase
      .from("therapists")
      .select("code,name,aliases,active")
      .ilike("name", `%${t}%`)
      .eq("active", true)
      .limit(1);
    if (data?.length) return data[0];
  }
  return null;
}

async function fetchSlotsWithNames(code, limit = 8) {
  const supabase = getSupabase();
  const nowISO = new Date().toISOString();
  const in72hISO = new Date(Date.now() + 72 * 3600 * 1000).toISOString();

  let q = supabase
    .from("therapist_availability")
    .select("id, therapist_code, start_utc, end_utc")
    .eq("status", "open")
    .gt("start_utc", nowISO)
    .lt("start_utc", in72hISO)
    .order("start_utc", { ascending: true })
    .limit(limit);

  if (code) q = q.eq("therapist_code", code);

  const { data: slots } = await q;
  if (!slots?.length) return [];

  const codes = [...new Set(slots.map(s => s.therapist_code))];
  const { data: ther } = await supabase
    .from("therapists")
    .select("code,name")
    .in("code", codes);

  const nameMap = {};
  ther?.forEach(t => (nameMap[t.code] = t.name));

  return (slots || []).map(s => ({
    availabilityId: s.id,
    therapistCode: s.therapist_code,
    therapistName: nameMap[s.therapist_code] || "Therapist",
    startUTC: s.start_utc,
    endUTC: s.end_utc
  }));
}

function compat(text, toolResults) {
  return {
    success: true,
    content: text,
    toolResults,
    reply: { role: "assistant", content: text },
    blocks: toolResults,
    response: text
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const {
    userMessage,
    userId,
    therapistCode,
    browserTz = "UTC",
    lang = "zh-CN",
    actor = "user",
    targetUserId = null
  } = req.body || {};

  if (!userMessage || !userId) {
    const msg = lang.startsWith("zh")
      ? "可以先跟我说说最近在意的事，或告诉我一个时间范围（例如“明天下午”），我来帮你查看可预约时间。"
      : "Tell me what's on your mind, or share a time window (e.g., 'tomorrow afternoon') and I can check availability.";
    return res.status(200).json(compat(msg, []));
  }

  try {
    const greetings = /(你好|您好|hello|hi|嗨|在吗|hey)/i;
    const wantBooking = isBookingIntent(userMessage) && !greetings.test(userMessage);

    if (wantBooking) {
      let resolved = null;
      try { resolved = await resolveTherapistFromText(userMessage); } catch {}
      const code = therapistCode || resolved?.code || DEFAULT_CODE;

      const options = await fetchSlotsWithNames(code, 8);
      const opts = options.length ? options : await fetchSlotsWithNames(null, 8);

      if (opts.length) {
        const text = lang.startsWith("zh")
          ? `已为您找到 ${opts.length} 个可预约时间，请选择：`
    const supabase = getSupabase()
          : `I found ${opts.length} available time slots. Please pick one:`;
        const createEnabled = actor === "user" || !!targetUserId;
        return res.status(200).json(
          compat(text, [{ type: "TIME_CONFIRM", options: opts.map(o => ({ ...o, targetUserId })), createEnabled, targetUserId }])
        );
      }

      const noSlot = lang.startsWith("zh")
        ? "当前时段暂无可约。可以换个时间范围（如“这周末下午”），我再帮你查。"
        : "No open slots in that window. Try another time range and I’ll check again.";
      return res.status(200).json(compat(noSlot, []));
    }

    const payload = { message: userMessage, context: { browserTz, lang } };
    try {
      const resp = await openai.responses.create(
      try { await supabase.from("ai_logs").insert({ scope: "chat", ok: true, model: "none", payload: JSON.stringify({ wantBooking: true, code, source: "api/chat" }), output: JSON.stringify({ options: options.length, fallback: options.length ? 0 : 1 }) }) } catch {}
        {
          model: "gpt-4o",
          input: [
            { role: "system", content: SYSTEM_PROMPT_USER },
            { role: "user", content: JSON.stringify(payload) }
          ],
          max_output_tokens: 600
        },
        { timeout: 12000 }
      );
      const text = resp.output_text ?? (resp.output?.[0]?.content?.[0]?.text ?? "");
      return res.status(200).json(compat(text || "我在这，愿意听你说说。", []));
    } catch {
      const fallback = lang.startsWith("zh")
      try { await supabase.from("ai_logs").insert({ scope: "chat", ok: true, model: "none", payload: JSON.stringify({ wantBooking: true, code, source: "api/chat" }), output: JSON.stringify({ slots: 0 }) }) } catch {}
        ? "我在这，先陪你说说发生了什么吧。如果你愿意，我们也可以在合适的时候安排一次专业咨询。"
        : "I’m here with you. Tell me what’s going on.";
      return res.status(200).json(compat(fallback, []));
    }
  } catch {
    return res.status(200).json(compat("抱歉，系统有点忙。请稍后再试。", []));
  }
}
