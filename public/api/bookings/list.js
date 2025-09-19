import { createClient } from "https://cdn.skypack.dev/@supabase/supabase-js@2";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function withCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
  withCors(res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      therapistHint = "",
      timeHint = "",
      lang = "zh-CN",
      hours = 96,
      limit = 8,
      userId = null,
    } = req.body || {};

    let therapistCode = process.env.THERAPIST_DEFAULT_CODE || null;

    if (therapistHint && therapistHint.trim()) {
      const { data: ths } = await supabase
        .from("therapists")
        .select("code,name,aliases,active")
        .ilike("name", `%${therapistHint}%`)
        .limit(1);

      if (ths && ths.length > 0) therapistCode = ths[0].code;
      else {
        const { data: th2 } = await supabase
          .from("therapists")
          .select("code,aliases,active")
          .contains("aliases", [therapistHint])
          .limit(1);
        if (th2 && th2.length > 0) therapistCode = th2[0].code;
      }
    }

    const now = new Date();
    const end = new Date(now.getTime() + Number(hours || 96) * 3600 * 1000);
    const startISO = now.toISOString();
    const endISO = end.toISOString();

    let q = supabase
      .from("therapist_availability")
      .select("id,therapist_code,start_utc,end_utc,booked")
      .eq("booked", false)
      .gte("start_utc", startISO)
      .lte("start_utc", endISO)
      .order("start_utc", { ascending: true })
      .limit(Number(limit || 8));

    if (therapistCode) q = q.eq("therapist_code", therapistCode);

    const { data: slots, error } = await q;
    if (error) return res.status(500).json({ ok: false, error: "list_failed" });

    const data = (slots || []).map(s => ({
      availabilityId: s.id,
      therapistCode: s.therapist_code,
      startUTC: s.start_utc,
      endUTC: s.end_utc,
      display: s.start_utc,
    }));

    return res.status(200).json({ ok: true, data, meta: { therapistCode, lang, timeHint, userId } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "exception" });
  }
}
