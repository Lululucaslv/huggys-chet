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
  const {
    userMessage = "",
    userId = "",
    therapistCode = null,
    browserTz = null,
    mode: modeBody = "user"
  } = req.body || {};
  const modeQuery = (req.query && (req.query.mode || req.query.m)) || undefined;
  const modeRaw = modeQuery || modeBody;

  const base = (process.env.DIFY_API_BASE || "https://api.dify.ai/v1").replace(/\/+$/, "");
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

    const r = await fetch(`${base}/workflows/run`, {
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

    const dj = await r.json().catch(() => ({}));

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

    let reply;
    if (out && typeof out === "object" && out.type === "TIME_CONFIRM") {
      reply = {
        role: "assistant",
        content: out.message || "请从下面的时间中选择：",
        type: "TIME_CONFIRM",
        options: Array.isArray(out.options) ? out.options : []
      };
    } else {
      let text = "";
      if (typeof out === "string") text = out;
      else if (hasOutputText) text = dj.data.output_text;
      else if (out && typeof out === "object" && (out.message || out.text)) text = out.message || out.text;
      if (!text) text = "我在，愿意听你说说。";
      reply = { role: "assistant", content: text };
    }

    const keyHint = (apiKey || "").slice(-6);
    await supabase.from("ai_logs").insert({
      scope, ok: true, model: "dify-workflow",
      payload: JSON.stringify({
        role: mode, mode, url, status: r.status, keyHint,
        outputsKeys, hasOutputText, outputTextLen, difyStatus,
        userId, therapistCode, browserTz, elapsed_ms: Date.now() - t0
      }).slice(0,4000),
      output: JSON.stringify({ reply, raw: dj }).slice(0,4000), ms: Date.now() - t0
    });

    return res.status(200).json({ reply });
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
