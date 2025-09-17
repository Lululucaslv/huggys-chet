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
  const {
    userMessage = "",
    userId = "",
    therapistCode = null,
    browserTz = null,
    mode: modeBody = "user"
  } = body
  const modeQuery = (req.query && (req.query.mode || req.query.m)) || undefined
  const modeRaw = modeQuery || modeBody

  const base = String(process.env.DIFY_API_BASE || "https://api.dify.ai/v1").replace(/\/+$/, "")
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

    const r = await fetch(`${base}/workflows/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        inputs: {
          user_message: userMessage,
          query: userMessage,
          user_id: userId || "anonymous",
          therapist_code: therapistCode,
          browser_tz: browserTz
        },
        response_mode: "blocking",
        user: userId || "anonymous"
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeout))

    const dj = await r.json().catch(() => ({}))
    let out = dj?.data?.outputs?.[0]?.value ?? dj?.data?.output_text ?? dj?.result ?? dj
    if (typeof out === "string") { try { out = JSON.parse(out) } catch {} }

    let reply
    if (out && typeof out === "object" && out.type === "TIME_CONFIRM") {
      reply = {
        role: "assistant",
        content: out.message || "请从下面的时间中选择：",
        type: "TIME_CONFIRM",
        options: Array.isArray(out.options) ? out.options : []
      }
    } else {
      const text = typeof out === "string" ? out : (dj?.data?.output_text || "我在，愿意听你说说。")
      reply = { role: "assistant", content: text }
    }

    try {
      await supabase.from("ai_logs").insert({
        scope, ok: true, model: "dify-workflow",
        payload: JSON.stringify({ userMessage, userId, therapistCode, browserTz, mode, status: r.status }).slice(0,4000),
        output: JSON.stringify({ reply, raw: dj }).slice(0,4000), ms: Date.now() - t0
      })
    } catch {}

    return res.status(200).json({ reply })
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
