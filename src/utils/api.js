// src/utils/api.js
export async function sendChat({ userMessage, userId, therapistCode, browserTz }) {
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userMessage, userId, therapistCode, browserTz })
  });

  let data = {};
  try { data = await r.json(); } catch {}

  const content =
    typeof data.content === "string" ? data.content :
    typeof data.text === "string" ? data.text : "";

  const toolResults = Array.isArray(data.toolResults)
    ? data.toolResults
    : Array.isArray(data.blocks)
    ? data.blocks
    : [];

  return {
    success: data.success === true || !!content,
    content,
    toolResults,
    raw: data
  };
}
