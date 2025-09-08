// public/api/chat.js
// Intent-first chat endpoint (ESM)
// - 普通聊天：OpenAI Responses + 用户端 Prompt ID（共情）
// - 预约意图：DB 查可用时段 → TIME_CONFIRM 芯片
// - 同会话抑制：近2小时已 BOOKING_SUCCESS 则不再推时段
// - 始终返回 { success, content, toolCalls:[], toolResults:[] }

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const DEFAULT_CODE = process.env.THERAPIST_DEFAULT_CODE || "8W79AL2B";
const isPreview =
  process.env.VERCEL_ENV === "preview" ||
  String(process.env.DEBUG_ERRORS || "").toLowerCase() === "true";

// 预约意图判定（中英文关键词）
function isBookingIntent(text = "") {
  const t = String(text).toLowerCase();
  const zh = /(预约|约个?时间|时间(段|点)|安排|可用|空闲|什么时候|哪天|几点|明天|后天|周[一二三四五六日天]|上午|下午|晚上)/;
  const en = /(book|booking|schedule|when can|available|availability|time slot|reschedule|slot)/;
  return zh.test(t) || en.test(t);
}

// 轻量日志（失败不阻塞）
async function logAILine(scope, entry = {}) {
  try {
    await supabase.from("ai_logs").insert({
      scope,
      ok: entry.ok ?? false,
      model: entry.model ?? "gpt-4o",
      prompt_id: entry.promptId ?? process.env.OPENAI_SYSTEM_PROMPT_ID,
      payload: typeof entry.payload === "string" ? entry.payload : entry.payload ? JSON.stringify(entry.payload) : null,
      output: typeof entry.output === "string" ? entry.output : entry.output ? JSON.stringify(entry.output) : null,
      error: entry.error ? String(entry.error) : null
    });
  } catch {}
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { userMessage, userId, therapistCode, browserTz = "UTC", lang = "zh-CN" } = req.body || {};
  if (!userMessage || !userId) {
    return res.status(200).json({
      success: true,
      content: "请告诉我你的情况，或说一个你方便的时间范围（例如：明天下午）。",
      toolCalls: [],
      toolResults: []
    });
  }

  try {
    const wantBooking = isBookingIntent(userMessage);

    // ————— 预约链路 —————
    if (wantBooking) {
      // 近2小时是否已有 BOOKING_SUCCESS → 抑制重复推时段
      const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
      const { data: recents } = await supabase
        .from("chats")
        .select("content, created_at")
        .eq("user_id", userId)
        .eq("role", "system")
        .gte("created_at", twoHoursAgo)
        .order("created_at", { ascending: false })
        .limit(5);

      const hasRecentBooking = (recents || []).some(r => {
        try { return JSON.parse(r.content || "")?.type === "BOOKING_SUCCESS"; } catch { return false; }
      });

      if (hasRecentBooking) {
        const text = lang.startsWith("zh")
          ? "已为您确认预约。如需改期或再约，请告诉我新的时间范围或偏好。"
          : "Your booking is confirmed. Share a new time window if you want to reschedule or book again.";
        await logAILine("chat", { ok: true, output: { suppress: true }, payload: { userMessage } });
        return res.status(200).json({ success: true, content: text, toolCalls: [], toolResults: [] });
      }

      // 查未来72h可用时段（确定性 chips）
      const code = therapistCode || DEFAULT_CODE;
      const nowISO = new Date().toISOString();
      const in72hISO = new Date(Date.now() + 72 * 3600 * 1000).toISOString();

      const { data: slots, error: availErr } = await supabase
        .from("therapist_availability")
        .select("id, therapist_code, start_utc, end_utc")
        .eq("status", "open")
        .eq("therapist_code", code)
        .gt("start_utc", nowISO)
        .lt("start_utc", in72hISO)
        .order("start_utc", { ascending: true })
        .limit(8);

      const list = (slots || []).map(s => ({
        availabilityId: s.id,
        therapistCode: s.therapist_code || code,
        startUTC: s.start_utc,
        endUTC: s.end_utc
      }));

      if (list.length) {
        const text = lang.startsWith("zh")
          ? `已为您找到 ${list.length} 个可预约时间，请选择：`
          : `I found ${list.length} available time slots. Please pick one:`;
        await logAILine("chat", { ok: true, output: { time_confirm: list.length }, payload: { userMessage } });
        return res.status(200).json({
          success: true,
          content: text,
          toolCalls: [],
          toolResults: [{ type: "TIME_CONFIRM", options: list }],
          ...(isPreview && availErr ? { debug: { availabilityError: availErr.message } } : {})
        });
      }

      // 没时段 → 引导换时间范围
      const noSlot = lang.startsWith("zh")
        ? "当前时段暂不可约。您可以换一个时间范围（例如“这周末下午”），我再帮你查看。"
        : "No open slots right now. Please share another time window and I’ll check again.";
      await logAILine("chat", { ok: true, output: { no_slots: true }, payload: { userMessage } });
      return res.status(200).json({ success: true, content: noSlot, toolCalls: [], toolResults: [] });
    }

    // ————— 共情聊天：使用你在 OpenAI 网站上调好的 Prompt —————
    const payload = { message: userMessage, context: { browserTz, lang } };
    try {
      const ai = await openai.responses.create(
        { model: "gpt-4o", prompt: { id: process.env.OPENAI_SYSTEM_PROMPT_ID }, input: [{ role: "user", content: JSON.stringify(payload) }] },
        { timeout: 12000 }
      );
      const text = ai.output_text ?? (ai.output?.[0]?.content?.[0]?.text ?? "");
      await logAILine("chat", { ok: true, output: text, payload: { userMessage } });
      // 持久化用户原话（异步）
      supabase.from("chats").insert({ booking_id: null, user_id: userId, role: "user", content: String(userMessage) }).then(()=>{});
      return res.status(200).json({ success: true, content: text, toolCalls: [], toolResults: [] });
    } catch (e) {
      const empathyFallback = lang.startsWith("zh")
        ? "我在这，先陪你说说发生了什么吧。如果你愿意，我们也可以在合适的时候安排一次专业咨询。"
        : "I’m here with you. Tell me what’s going on. If you’d like, we can arrange a session later.";
      await logAILine("chat", { ok: false, error: e?.message, payload: { userMessage } });
      return res.status(200).json({
        success: true,
        content: empathyFallback,
        toolCalls: [],
        toolResults: [],
        ...(isPreview ? { debug: { error: String(e?.message || "") } } : {})
      });
    }
  } catch (err) {
    const fallback = "抱歉，系统有点忙。请再说说你的情况，或告诉我一个你方便的时间范围，我会继续帮你。";
    await logAILine("chat", { ok: false, error: err?.message, payload: { userMessage } });
    return res.status(200).json({ success: true, content: fallback, toolCalls: [], toolResults: [] });
  }
}
