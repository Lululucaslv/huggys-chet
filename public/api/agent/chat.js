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
  } = req.body || {};

  const base = (process.env.DIFY_API_BASE || "").replace(/\/+$/, "");
  const key = process.env.DIFY_API_KEY;

  try {
    if (!base || !key) {
      const reply = { role: "assistant", content: "（系统暂未接通工作流，我在，愿意听你说说。）" };
      await supabase.from("ai_logs").insert({
        scope: "agent_chat", ok: true, model: "fallback",
        payload: JSON.stringify({ userMessage, userId }),
        output: JSON.stringify(reply), ms: Date.now() - t0
      });
      return res.status(200).json({ reply });
    }

    const r = await fetch(`${base}/v1/workflows/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        inputs: {
          query: userMessage,
          user_id: userId || "anonymous",
          therapist_code: therapistCode,
          browser_tz: browserTz,
        },
        response_mode: "blocking",
        user: userId || "anonymous",
      }),
    });

    const dj = await r.json().catch(() => ({}));
    let out = dj?.data?.outputs?.[0]?.value ?? dj?.data?.output_text ?? dj?.result ?? dj;

    if (typeof out === "string") {
      try { out = JSON.parse(out); } catch {}
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
      const text = typeof out === "string"
        ? out
        : (dj?.data?.output_text || "我在，愿意听你说说。");
      reply = { role: "assistant", content: text };
    }

    await supabase.from("ai_logs").insert({
      scope: "agent_chat", ok: true, model: "dify-workflow",
      payload: JSON.stringify({ userMessage, userId }),
      output: JSON.stringify(reply), ms: Date.now() - t0
    });

    return res.status(200).json({ reply });
  } catch (e) {
    await supabase.from("ai_logs").insert({
      scope: "agent_chat", ok: false, model: "dify-workflow",
      error: String(e), ms: Date.now() - t0
    });
    return res.status(200).json({
      reply: { role: "assistant", content: "抱歉，服务有点忙，稍后再试可以吗？" }
    });
  }
}
