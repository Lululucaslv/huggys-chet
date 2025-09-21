import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const SYSTEM_PROMPT_THERAPIST = `
You are an AI assistant that prepares therapists for upcoming sessions.

Always output a single JSON object of type "SESSION_SUMMARY" with this schema:
{
  "type": "SESSION_SUMMARY",
  "bookingId": "<id>",
  "therapistCode": "<code>",
  "clientName": "<name>",
  "sessionTimeUTC": "<ISO 8601 UTC time>",
  "sessionTimeDisplayTZ": "<IANA timezone>",
  "concerns": ["..."],
  "riskSignals": ["..."],
  "goals": ["..."],
  "suggestedQuestions": ["..."],
  "copingStrategies": ["..."]
}

Input includes: bookingId, therapistCode, clientName (if any), sessionTime (UTC), browser timezone, and recent chat transcript.
Rules:
- Be professional, neutral, concise. No chit-chat or extra prose.
- If information is missing, infer from context.
- Validate schema; if parsing would fail, retry once; if still failing, return a minimal valid SESSION_SUMMARY with empty arrays.
- Output MUST be JSON only (no leading/trailing text).
`;

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const bookingId = String(req.query.bookingId || "");
    if (!bookingId) return res.status(400).json({ error: "bookingId required" });

    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("id, therapist_code, start_utc, duration_mins, user_id")
      .eq("id", bookingId)
      .single();
    if (bErr || !booking) return res.status(404).json({ error: "booking not found" });

    const { data: chats } = await supabase
      .from("chats")
      .select("role, content, created_at")
      .eq("user_id", booking.user_id)
      .order("created_at", { ascending: false })
      .limit(30);

    const payload = {
      bookingId: booking.id,
      therapistCode: booking.therapist_code,
      clientName: "",
      sessionTimeUTC: booking.start_utc,
      browserTimezone: "UTC",
      recentChats: (chats || []).map((c) => ({ role: c.role, content: c.content, at: c.created_at }))
    };

    const resp = await openai.responses.create(
      {
        model: "gpt-5",
        input: [
          { role: "system", content: SYSTEM_PROMPT_THERAPIST },
          { role: "user", content: JSON.stringify(payload) }
        ],
        max_output_tokens: 1200
      },
      { timeout: 15000 }
    );

    const text = resp.output_text ?? (resp.output?.[0]?.content?.[0]?.text ?? "");

    let summary;
    try {
      summary = JSON.parse(text);
      if (summary?.type !== "SESSION_SUMMARY") throw new Error("invalid type");
    } catch {
      summary = {
        type: "SESSION_SUMMARY",
        bookingId: booking.id,
        therapistCode: booking.therapist_code,
        clientName: "",
        sessionTimeUTC: booking.start_utc,
        sessionTimeDisplayTZ: "UTC",
        concerns: [],
        riskSignals: [],
        goals: [],
        suggestedQuestions: [],
        copingStrategies: []
      };
    }

    try {
      await supabase.from("ai_logs").insert({
        scope: "summary",
        ok: true,
        model: "gpt-5",
        payload: JSON.stringify(payload),
        output: JSON.stringify(summary)
      });
    } catch {}

    return res.status(200).json({ summary });
  } catch (err) {
    try {
      await supabase.from("ai_logs").insert({
        scope: "summary",
        ok: false,
        error: String(err?.message || err || "unknown")
      });
    } catch {}
    return res.status(500).json({ error: "summary failed" });
  }
}
