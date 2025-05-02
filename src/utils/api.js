export async function sendChat({ userId, messages }) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15 秒超时保护

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, message: messages[messages.length - 1]?.content }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errorText = await res.text();
      console.error("GPT 接口返回错误：", errorText);
      throw new Error("服务器错误，请稍后重试");
    }

    const data = await res.json();
    return {
      reply: {
        role: "assistant",
        content: data.response
      }
    };
  } catch (err) {
    console.error("发送 GPT 消息失败：", err);
    throw new Error("连接 GPT 接口失败");
  }
}
