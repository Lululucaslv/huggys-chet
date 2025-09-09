import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

const DEFAULT_CODE = process.env.THERAPIST_DEFAULT_CODE || "8W79AL2B";

function normalizeTherapistFromText(text = "") {
  const t = String(text || "").toLowerCase();
  const map = {
    "megan chang": "8W79AL2B",
    "megan": "8W79AL2B",
    "hanqi lyu": "8W79AL2B",
    "hanqi": "8W79AL2B",
  };
  for (const k of Object.keys(map)) {
    if (t.includes(k)) return map[k];
  }
  return null;
}

async function logAILine(supabase, scope, entry = {}) {
  if (!supabase) return;
  try {
    await supabase.from("ai_logs").insert({
      scope,
      ok: entry.ok ?? false,
      model: entry.model ?? "gpt-4o",
      prompt_id: entry.promptId ?? process.env.OPENAI_SYSTEM_PROMPT_ID,
      payload:
        typeof entry.payload === "string"
          ? entry.payload
          : entry.payload
          ? JSON.stringify(entry.payload)
          : null,
      output:
        typeof entry.output === "string"
          ? entry.output
          : entry.output
          ? JSON.stringify(entry.output)
          : null,
      error: entry.error ? String(entry.error) : null,
    });
  } catch {}
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const supabase = getSupabase();

  try {
    const {
      userMessage,
      userId,
      therapistCode,
      browserTz = "UTC",
      lang = "zh-CN",
      actor = "user",
      targetUserId
    } = req.body || {};
    if (!userMessage || !userId) {
      res.status(400).json({ error: "userMessage and userId required" });
      return;
    }

    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    if (supabase) {
      const { data: recentSystem } = await supabase
        .from("chats")
        .select("id, content, created_at")
        .eq("user_id", userId)
        .eq("role", "system")
        .gte("created_at", twoHoursAgo)
        .order("created_at", { ascending: false })
        .limit(5);

      const hasRecentBooking = (recentSystem || []).some((r) => {
        try {
          const j = JSON.parse(r.content || "");
          return j?.type === "BOOKING_SUCCESS";
        } catch {
          return false;
        }
      });

      if (hasRecentBooking) {
        const text = lang.startsWith("zh")
          ? "已为您确认预约。如需改期或再次预约，请告诉我新的时间范围或偏好。"
          : "Your booking is confirmed. Tell me a new time window if you want to reschedule or book another session.";
        await logAILine(supabase, "chat", { ok: true, output: { suppress: true } });
        res.status(200).json({
          success: true,
          content: text,
          toolCalls: [],
          toolResults: [],
        });
        return;
      }
    }

    const code =
      therapistCode ||
      normalizeTherapistFromText(userMessage) ||
      DEFAULT_CODE;

    const nowISO = new Date().toISOString();
    const in72hISO = new Date(Date.now() + 72 * 3600 * 1000).toISOString();

    let list = [];
    let availErrMsg = null;
    if (supabase) {
      let therapistProfileId = null;
      try {
        const { data: t } = await supabase
          .from("therapists")
          .select("user_id, code")
          .eq("code", code)
          .maybeSingle();
        if (t?.user_id) {
          const { data: prof } = await supabase
            .from("user_profiles")
            .select("id, user_id")
            .eq("user_id", String(t.user_id))
            .maybeSingle();
          therapistProfileId = prof?.id || null;
        }
      } catch {}

      if (therapistProfileId) {
        const { data: slots, error: availErr } = await supabase
          .from("availability")
          .select("id, therapist_id, start_time, end_time, is_booked")
          .eq("therapist_id", therapistProfileId)
          .or("is_booked.is.null,is_booked.eq.false")
          .gt("start_time", nowISO)
          .lt("start_time", in72hISO)
          .order("start_time", { ascending: true })
          .limit(8);
        if (availErr) availErrMsg = availErr.message;
        let listA = (slots || []).map((s) => ({
          availabilityId: s.id,
          therapistCode: code,
          startUTC: s.start_time,
          endUTC: s.end_time,
        }));

        if (!listA.length) {
          const { data: slots2, error: err2 } = await supabase
            .from("therapist_availability")
            .select("id, therapist_code, start_utc, end_utc, status")
            .eq("status", "open")
            .eq("therapist_code", code)
            .gt("start_utc", nowISO)
            .lt("start_utc", in72hISO)
            .order("start_utc", { ascending: true })
            .limit(8);
          if (err2) availErrMsg = err2.message;
          listA = (slots2 || []).map((r) => ({
            availabilityId: r.id,
            therapistCode: code,
            startUTC: r.start_utc,
            endUTC: r.end_utc,
          }));
        }

        list = listA;
      }
    }

    if (list.length) {
      const text = lang.startsWith("zh")
        ? `已为您找到 ${list.length} 个可预约时间，请选择：`
        : `I found ${list.length} available time slots. Please pick one:`;

      const createEnabled =
        actor === "user" || (actor === "therapist" && !!targetUserId);

      await logAILine(supabase, "chat", {
        ok: true,
        output: { time_confirm: list.length, actor, createEnabled },
      });
      res.status(200).json({
        success: true,
        content: text,
        toolCalls: [],
        toolResults: [
          {
            type: "TIME_CONFIRM",
            options: list,
            createEnabled,
            targetUserId: targetUserId || null,
          },
        ],
        reply: { role: "assistant", content: text },
        blocks: [
          {
            type: "TIME_CONFIRM",
            options: list,
            createEnabled,
            targetUserId: targetUserId || null,
          },
        ],
        response: text,
        ...(process.env.VERCEL_ENV === "preview" && availErrMsg
          ? { debug: { availabilityError: availErrMsg } }
          : {}),
      });
      return;
    }

    const payload = {
      message: userMessage,
      context: {
        browserTz,
        therapistCode: code,
        availability: [],
        availabilityCount: 0,
        lang,
      },
    };

    try {
      const resp = await openai.responses.create(
        {
          model: "gpt-4o",
          prompt: { id: process.env.OPENAI_SYSTEM_PROMPT_ID },
          input: [{ role: "user", content: JSON.stringify(payload) }],
        },
        { timeout: 12000 }
      );
      const text =
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        resp.output_text ?? (resp.output?.[0]?.content?.[0]?.text ?? "");
      await logAILine(supabase, "chat", {
        ok: true,
        model: "gpt-4o",
        promptId: process.env.OPENAI_SYSTEM_PROMPT_ID,
        payload,
        output: text,
      });

      res.status(200).json({
        success: true,
        content: text,
        toolCalls: [],
        toolResults: [],
      });
      return;
    } catch (llmErr) {
      const fallback = lang.startsWith("zh")
        ? "抱歉，查询有点慢。您可换一个时间范围（例如“本周末下午”），或告诉我偏好的时区/咨询师，我再查一次。"
        : "Sorry, it’s a bit slow. Please try another time window (e.g., this weekend afternoon) or share your preferred timezone/therapist.";
      await logAILine(supabase, "chat", { ok: false, error: llmErr?.message });
      res.status(200).json({
        success: true,
        content: fallback,
        toolCalls: [],
        toolResults: [],
      });
      return;
    }
  } catch (err) {
    const fallback =
      "抱歉，系统有点忙。请换一个时间范围（例如“明天上午/下午”），或告诉我偏好的时区/咨询师，我再查一次。";
    const supabase2 = getSupabase();
    await logAILine(supabase2, "chat", { ok: false, error: err?.message });
    res.status(200).json({
      success: true,
      content: fallback,
      toolCalls: [],
      toolResults: [],
    });
  }
}
