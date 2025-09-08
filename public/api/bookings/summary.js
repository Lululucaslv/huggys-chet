// public/api/bookings/summary.js
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

export default async function handler(req, res) {
  try {
    const bookingId = String(req.query.bookingId || "");
    if (!bookingId) return res.status(400).json({ error: "bookingId required" });

    const { data: booking, error: e1 } = await supabase
      .from("bookings")
      .select("id, therapist_code, start_utc, duration_mins, user_id")
      .eq("id", bookingId).single();
    if (e1 || !booking) return res.status(404).json({ error: "booking not found" });

    const { data: chatHistory } = await supabase
      .from("chats")
      .select("id, role, content, created_at")
      .eq("booking_id", booking.id)
      .eq("user_id", booking.user_id)
      .order("created_at", { ascending: false })
      .limit(20);

    const payload = {
      bookingId: booking.id,
      therapistCode: booking.therapist_code,
      clientName: "", // 若有用户档案可填
      sessionTimeUTC: booking.start_utc,
      browserTimezone: "UTC",
      transcript: chatHistory || []
    };

    const resp = await openai.responses.create(
      { model: "gpt-5", prompt: { id: process.env.OPENAI_SYSTEM_PROMPT_THERAPIST_ID }, input: [{ role: "user", content: JSON.stringify(payload) }] },
      { timeout: 15000 }
    );
    const text = resp.output_text ?? (resp.output?.[0]?.content?.[0]?.text ?? "");

    let summary;
    try {
      summary = JSON.parse(text);
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
    res.status(200).json({ summary });
  } catch {
    res.status(500).json({ error: "summary failed" });
  }
}
