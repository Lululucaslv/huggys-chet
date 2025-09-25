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
  const modeQuery = (req.query && (req.query.mode || req.query.m)) || undefined
  const fromBody = body.mode || body.actor
  const inferred = /therapist/i.test(String(req.headers?.referer || "")) ? "therapist" : "user"
  const modeRaw = modeQuery || fromBody || inferred

  const baseRaw = String(process.env.DIFY_API_BASE || "https://api.dify.ai").replace(/\/+$/, "")
  const base = baseRaw
  const runPath = baseRaw.endsWith("/v1") ? "/workflows/run" : "/v1/workflows/run"
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

    const url = `${base}${runPath}`
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

    const respText = await r.text().catch(() => "")
    let dj = {}
    try { dj = respText ? JSON.parse(respText) : {} } catch { dj = {} }

    const outputs = dj?.data?.outputs
    const outputsArr = Array.isArray(outputs) ? outputs : []
    const outputsObj = outputs && !Array.isArray(outputs) && typeof outputs === "object" ? outputs : null

    const candidates = []

    if (typeof dj?.data?.output_text === "string" && dj.data.output_text.trim()) {
      candidates.push(dj.data.output_text.trim())
    }
    const topFields = [dj?.result?.reply, dj?.result?.text, dj?.message, dj?.text]
    for (const v of topFields) {
      if (typeof v === "string" && v.trim()) candidates.push(v.trim())
    }

    const pushValue = (val) => {
      if (!val) return
      if (typeof val === "string" && val.trim()) {
        candidates.push(val.trim())
        return
      }
      if (typeof val === "object" && val) {
        if (typeof val.text === "string" && val.text.trim()) {
          candidates.push(val.text.trim())
          return
        }
        if (Array.isArray(val)) {
          const joined = val.filter(x => typeof x === "string" && x.trim()).join("\n")
          if (joined) candidates.push(joined)
        }
      }
    }

    const preferred = ["reply", "answer", "final", "final_text", "text", "message"]

    if (outputsArr.length) {
      for (const key of preferred) {
        const found = outputsArr.find(o => (o?.name || o?.key) === key)
        if (found) pushValue(found.value)
      }
      for (const o of outputsArr) pushValue(o?.value)
    } else if (outputsObj) {
      for (const key of preferred) pushValue(outputsObj[key])
      for (const [, v] of Object.entries(outputsObj)) pushValue(v)
    }

    const first = candidates.find(Boolean)
    let out = first
    let tc = null

    if (typeof out === "string") {
      const s = out.trim()
      if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
        try {
          const j = JSON.parse(s)
          if (j && typeof j === "object" && j.type === "TIME_CONFIRM") tc = j
          else out = j
        } catch {}
      }
    }

    let text = ""
    if (tc) {
      text = tc.message || "请从下面的时间中选择："
    } else if (typeof out === "string") {
      text = out
    } else if (out && typeof out === "object" && (out.message || out.text)) {
      text = out.message || out.text
    } else if (typeof dj?.data?.output_text === "string") {
      text = dj.data.output_text
    }
    if (!text) text = "我在，愿意听你说说。"

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
        output: JSON.stringify({ text, timeConfirm: !!tc, raw: dj, status: r.status, respLen: (respText||'').length }).slice(0, 4000),
        ms: Date.now() - t0
      })
    } catch {}

    const compat = tc
      ? { ok: true, source: "dify", type: "TIME_CONFIRM", options: tc.options, text, raw: dj, reply: { role: "assistant", content: text, type: "TIME_CONFIRM", options: tc.options } }
      : { ok: true, source: "dify", text, raw: dj, reply: { role: "assistant", content: text } }

    return res.status(200).json(compat)
  } catch (e) {
    const errMsg = String(e?.message || e)
    const suspicious = !!therapistCode && mode !== "therapist"
    if (mode === "user") {
      try {
        await supabase.from("ai_logs").insert({
          scope, ok: false, model: "dify-workflow",
          payload: JSON.stringify({ mode, userId, therapistCode, browserTz, suspicious }).slice(0, 4000),
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
          payload: JSON.stringify({ mode, userId, therapistCode, browserTz, suspicious }).slice(0, 4000),
          error: errMsg, ms: Date.now() - t0
        })
      } catch {}
      return res.status(500).json({ error: "dify_failed" })
    }
  }
}
