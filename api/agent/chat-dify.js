import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

function withCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
}

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

export default async function handler(req, res) {
  withCors(res)

  if (req.method === "OPTIONS") return res.status(200).end()
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS")
    return res.status(405).json({ error: "Method not allowed" })
  }

  const t0 = Date.now()
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {})
  const userMessage = body.userMessage ?? body.query ?? body.message ?? body.content ?? ""
  const userId = body.userId ?? body.user_id ?? body.user ?? ""
  const therapistCode = body.therapistCode ?? body.therapist_code ?? null
  const browserTz = body.browserTz ?? body.browser_tz ?? null
  const modeBody = body.mode ?? "user"
  const modeQuery = (req.query && (req.query.mode || req.query.m)) || undefined
  const modeRaw = modeQuery || modeBody

  const base = String(process.env.DIFY_API_BASE || "https://api.dify.ai").replace(/\/+$/, "")
  const mode = String(modeRaw || "user").toLowerCase() === "therapist" ? "therapist" : "user"
  const apiKey = mode === "therapist" ? process.env.DIFY_THERAPIST_API_KEY : process.env.DIFY_USER_API_KEY
  const scope = mode === "therapist" ? "agent_chat_therapist" : "agent_chat_user"

  try {
    if (!base || !apiKey) {
      const msg = !base ? "Missing DIFY_API_BASE" : "Missing Dify API Key"
      if (mode === "user") {
        const reply = { role: "assistant", content: "抱歉，服务暂不可用，请稍后再试。", fallback: true, error: msg }
        try {
          await supabase.from("ai_logs").insert({
            scope, ok: false, model: "dify-workflow",
            payload: JSON.stringify({ userMessage, userId, therapistCode, browserTz, mode }),
            error: msg, ms: Date.now() - t0
          })
        } catch {}
        return res.status(200).json({ reply })
      } else {
        try {
          await supabase.from("ai_logs").insert({
            scope, ok: false, model: "dify-workflow",
            payload: JSON.stringify({ userMessage, userId, therapistCode, browserTz, mode }),
            error: msg, ms: Date.now() - t0
          })
        } catch {}
        return res.status(400).json({ error: msg })
      }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)

    const url = `${base}/v1/workflows/run`
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        inputs: {
          user_message: userMessage,
          query: userMessage,
          user_id: userId || "anonymous",
          therapist_code: therapistCode,
          therapistCode: therapistCode,
          browser_tz: browserTz
        },
        response_mode: "blocking",
        user: userId || "anonymous"
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeout))

    const dj = await r.json().catch(() => ({}))

    const outputs = dj?.data?.outputs
    const outputsArr = Array.isArray(outputs) ? outputs : []
    const outputsObj = outputs && !Array.isArray(outputs) && typeof outputs === "object" ? outputs : null

    const pickFromArray = (arr, key) => {
      const byKey = arr.find(o => (o?.name || o?.key) === key)
      if (byKey && byKey.value) return byKey.value
      const firstWithValue = arr.find(o => o && o.value)
      return firstWithValue ? firstWithValue.value : null
    }
    const pickFromObject = (obj, key) => {
      if (!obj) return null
      if (obj[key] != null) return obj[key]
      const vals = Object.values(obj)
      return vals.length ? vals[0] : null
    }

    let out =
      (outputsArr.length ? (pickFromArray(outputsArr, "reply") ?? null) : null) ??
      (typeof dj?.data?.output_text === "string" ? dj.data.output_text : null) ??
      (outputsArr.length ? (pickFromArray(outputsArr, "answer") ?? null) : null) ??
      (dj?.result && (dj.result.reply || dj.result.text) ? (dj.result.reply || dj.result.text) : null) ??
      (outputsObj ? (pickFromObject(outputsObj, "reply") ?? pickFromObject(outputsObj, "answer")) : null) ??
      (dj?.message || dj?.text || null)

    if (typeof out === "string") {
      const s = out.trim()
      if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
        try { out = JSON.parse(out) } catch {}
      }
    }

    let text = ""
    let tc = null
    if (out && typeof out === "object" && out.type === "TIME_CONFIRM") {
      tc = {
        type: "TIME_CONFIRM",
        options: Array.isArray(out.options) ? out.options : [],
        message: out.message || "请从下面的时间中选择："
      }
      text = tc.message
    } else {
      if (typeof out === "string") text = out
      else if (typeof dj?.data?.output_text === "string") text = dj.data.output_text
      else if (out && typeof out === "object" && (out.message || out.text)) text = out.message || out.text
      if (!text) text = "我在，愿意听你说说。"
    }

    try {
      const keyHint = (apiKey || "").slice(-6)
      const outputsKeys = outputsArr.length
        ? outputsArr.map(o => o?.name || o?.key).filter(Boolean)
        : (outputsObj ? Object.keys(outputsObj) : [])
      const hasOutputText = typeof dj?.data?.output_text === "string"
      const outputTextLen = hasOutputText ? dj.data.output_text.length : 0
      const difyStatus = dj?.status || dj?.data?.status

      await supabase.from("ai_logs").insert({
        scope,
        ok: true,
        model: "dify-workflow",
        payload: JSON.stringify({
          mode,
          role: mode,
          url,
          status: r.status,
          keyHint,
          outputsKeys,
          hasOutputText,
          outputTextLen,
          difyStatus,
          userId,
          therapistCode,
          browserTz,
          elapsed_ms: Date.now() - t0
        }).slice(0, 4000),
        output: JSON.stringify({ text, timeConfirm: !!tc, raw: dj }).slice(0, 4000),
        ms: Date.now() - t0
      })
    } catch {}

    const compat = tc
      ? { ok: true, source: "dify", type: "TIME_CONFIRM", options: tc.options, text, raw: dj, reply: { role: "assistant", content: text, type: "TIME_CONFIRM", options: tc.options } }
      : { ok: true, source: "dify", text, raw: dj, reply: { role: "assistant", content: text } }

    return res.status(200).json(compat)
  } catch (e) {
    const errMsg = String(e?.message || e)
    if (mode === "user") {
      try {
        await supabase.from("ai_logs").insert({
          scope, ok: false, model: "dify-workflow",
          error: errMsg, ms: Date.now() - t0
        })
      } catch {}
      return res.status(200).json({
        reply: { role: "assistant", content: "抱歉，服务有点忙，稍后再试可以吗？", fallback: true }
      })
    } else {
      try {
        await supabase.from("ai_logs").insert({
          scope, ok: false, model: "dify-workflow",
          error: errMsg, ms: Date.now() - t0
        })
      } catch {}
      return res.status(500).json({ error: "dify_failed" })
    }
  }
}
