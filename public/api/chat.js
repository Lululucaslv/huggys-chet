// public/api/chat.js
// - 确定性 TIME_CONFIRM：直接从 DB 拿可约时段，返回结构化 chips
// - 同会话抑制：最近 2 小时已有 BOOKING_SUCCESS 就不再推时段
// - OpenAI 仅在无可约时段时调用（12s 超时）
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

  try {
    const { userMessage, userId, therapistCode, browserTz = "UTC", lang = "zh-CN" } = req.body || {};
    if (!userMessage || !userId) {
      return res.status(200).json({
        success: true,
        content: "请告诉我你的问题和偏好的时间范围（例如：明天下午）。",
        toolCalls: [],
        toolResults: []
      });
    }

    // ① 同会话抑制（近 2h 有 BOOKING_SUCCESS）
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
        : "Your booking is confirmed. Tell me a new time window if you want to reschedule or book another session.";
      await logAILine("chat", { ok: true, output: { suppress: true } });
      return res.status(200).json({ success: true, content: text, toolCalls: [], toolResults: [] });
    }

    // ② 确定性可用时段（直接查 DB，避免从文本解析时间）
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
      await logAILine("chat", { ok: true, output: { time_confirm: list.length } });
      return res.status(200).json({
        success: true,
        content: text,
        toolCalls: [],
        toolResults: [{ type: "TIME_CONFIRM", options: list }],
        ...(isPrev
