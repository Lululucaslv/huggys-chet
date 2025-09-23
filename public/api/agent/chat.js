<<<<<<< HEAD
import { createClient } from "@supabase/supabase-js";

function withCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  withCors(res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const t0 = Date.now();
  const b = req.body || {};
  const userMessage = b.userMessage ?? b.query ?? b.message ?? b.content ?? "";
  const userId = b.userId ?? b.user_id ?? b.user ?? "";
  const therapistCode = b.therapistCode ?? b.therapist_code ?? null;
  const browserTz = b.browserTz ?? b.browser_tz ?? null;
  const modeBody = b.mode ?? "user";
  const modeQuery = (req.query && (req.query.mode || req.query.m)) || undefined;
  const modeRaw = modeQuery || modeBody;

  const baseRaw = (process.env.DIFY_API_BASE || "https://api.dify.ai").replace(/\/+$/, "");
  const base = baseRaw;
  const runPath = baseRaw.endsWith("/v1") ? "/workflows/run" : "/v1/workflows/run";
  const mode = String(modeRaw || "user").toLowerCase() === "therapist" ? "therapist" : "user";
  const apiKey = mode === "therapist" ? process.env.DIFY_THERAPIST_API_KEY : process.env.DIFY_USER_API_KEY;
  const scope = mode === "therapist" ? "agent_chat_therapist" : "agent_chat_user";

  try {
    if (!base || !apiKey) {
      const msg = !base ? "Missing DIFY_API_BASE" : "Missing Dify API Key";
      if (mode === "user") {
        const reply = { role: "assistant", content: "抱歉，服务暂不可用，请稍后再试。", fallback: true, error: msg };
        await supabase.from("ai_logs").insert({
          scope, ok: false, model: "dify-workflow",
          payload: JSON.stringify({ userMessage, userId, therapistCode, browserTz, mode }),
          error: msg, ms: Date.now() - t0
        });
        return res.status(200).json({ reply });
      } else {
        await supabase.from("ai_logs").insert({
          scope, ok: false, model: "dify-workflow",
          payload: JSON.stringify({ userMessage, userId, therapistCode, browserTz, mode }),
          error: msg, ms: Date.now() - t0
        });
        return res.status(400).json({ error: msg });
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const r = await fetch(`${base}${runPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: {
          user_message: userMessage,
          query: userMessage,
          user_id: userId || "anonymous",
          therapist_code: therapistCode,
          therapistCode: therapistCode,
          browser_tz: browserTz,
        },
        response_mode: "blocking",
        user: userId || "anonymous"
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));

    const respText = await r.text().catch(() => "");
    let dj = {};
    try { dj = respText ? JSON.parse(respText) : {}; } catch { dj = {}; }

    const outputsArr = Array.isArray(dj?.data?.outputs) ? dj.data.outputs : [];
    const outputsObj = dj?.data?.outputs && !Array.isArray(dj.data.outputs) && typeof dj.data.outputs === "object" ? dj.data.outputs : null;
    const outputsKeys = outputsArr.length ? outputsArr.map(o => o?.name || o?.key).filter(Boolean) : (outputsObj ? Object.keys(outputsObj) : []);
    const hasOutputText = typeof dj?.data?.output_text === "string";
    const outputTextLen = hasOutputText ? dj.data.output_text.length : 0;
    const difyStatus = dj?.status || dj?.data?.status;
    const url = `${base}/workflows/run`;

    const pickByKey = (key) => {
      if (outputsArr.length) {
        const byKey = outputsArr.find(o => (o?.name || o?.key) === key);
        if (byKey && byKey.value != null) return byKey.value;
      }
      if (outputsObj && outputsObj[key] != null) return outputsObj[key];
      return null;
    };

    let out = pickByKey("reply");
    if (out == null) out = hasOutputText ? dj.data.output_text : null;
    if (out == null) out = pickByKey("answer");
    if (out == null) out = dj?.result?.reply ?? dj?.result?.text ?? null;
    if (out == null) out = dj?.message ?? dj?.text ?? null;

    if (typeof out === "string") {
      try { const maybe = JSON.parse(out); out = maybe; } catch {}
    }

    let text = "";
    let tc = null;
    if (out && typeof out === "object" && out.type === "TIME_CONFIRM") {
      tc = {
        type: "TIME_CONFIRM",
        options: Array.isArray(out.options) ? out.options : [],
        message: out.message || "请从下面的时间中选择："
      };
      text = tc.message;
    } else {
      if (typeof out === "string") text = out;
      else if (hasOutputText) text = dj.data.output_text;
      else if (out && typeof out === "object" && (out.message || out.text)) text = out.message || out.text;
      if (!text) text = "我在，愿意听你说说。";
    }

    const keyHint = (apiKey || "").slice(-6);
    await supabase.from("ai_logs").insert({
      scope, ok: true, model: "dify-workflow",
      payload: JSON.stringify({
        role: mode, mode, url, status: r.status, keyHint,
        outputsKeys, hasOutputText, outputTextLen, difyStatus,
        userId, therapistCode, browserTz, elapsed_ms: Date.now() - t0
      }).slice(0,4000),
      output: JSON.stringify({ text, timeConfirm: !!tc, raw: dj, status: r.status, respLen: (respText||'').length }).slice(0,4000), ms: Date.now() - t0
    });

    const compat = tc
      ? { ok: true, source: "dify", type: "TIME_CONFIRM", options: tc.options, text, raw: dj, reply: { role: "assistant", content: text, type: "TIME_CONFIRM", options: tc.options } }
      : { ok: true, source: "dify", text, raw: dj, reply: { role: "assistant", content: text } };

    return res.status(200).json(compat);
  } catch (e) {
    const errMsg = String(e);
    const keyHint = (apiKey || "").slice(-6);
    const url = `${base}/workflows/run`;
    const elapsed = Date.now() - t0;
    if (mode === "user") {
      await supabase.from("ai_logs").insert({
        scope, ok: false, model: "dify-workflow",
        payload: JSON.stringify({ role: mode, mode, url, keyHint, userId, therapistCode, browserTz, elapsed_ms: elapsed }).slice(0,4000),
        error: errMsg, ms: elapsed
      });
      return res.status(200).json({
        reply: { role: "assistant", content: "抱歉，服务有点忙，稍后再试可以吗？", fallback: true }
      });
    } else {
      await supabase.from("ai_logs").insert({
        scope, ok: false, model: "dify-workflow",
        payload: JSON.stringify({ role: mode, mode, url, keyHint, userId, therapistCode, browserTz, elapsed_ms: elapsed }).slice(0,4000),
        error: errMsg, ms: elapsed
      });
      return res.status(500).json({ error: "dify_failed" });
    }
  }
}
||||||| 0f5d440
export { default } from "../chat.js";
=======
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
>>>>>>> origin/main
