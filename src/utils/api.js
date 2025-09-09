// src/utils/api.js

// 统一聊天请求：/api/chat
export async function sendChat({
  userMessage,
  userId,
  therapistCode,
  browserTz,
  actor = "therapist",
  targetUserId = null,
  lang = (typeof navigator !== "undefined" ? navigator.language : "zh-CN")
}) {
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userMessage,
      userId,
      therapistCode,
      browserTz,
      actor,
      targetUserId,
      lang
    })
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

// 新增：创建预约 /api/bookings/create
export async function createBooking({ availabilityId, therapistCode, userId, startUTC, durationMins = 60 }) {
  const r = await fetch("/api/bookings/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ availabilityId, therapistCode, userId, startUTC, durationMins })
  });

  let data = {};
  try { data = await r.json(); } catch {}
  return data; // { booking } 或 { error }
}
