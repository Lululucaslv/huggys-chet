import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return createClient(url, key, { auth: { persistSession: false } })
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" })
    const code = String(req.query.code || "").trim()
    if (!code) return res.status(400).json({ error: "missing code" })

    const supabase = getSupabase()
    const nowISO = new Date().toISOString()
    const in72 = new Date(Date.now() + 72 * 3600 * 1000).toISOString()
    const in168 = new Date(Date.now() + 168 * 3600 * 1000).toISOString()

    const { data: ta72 } = await supabase
      .from("therapist_availability")
      .select("id, therapist_code, start_utc, end_utc, status")
      .eq("therapist_code", code)
      .eq("status", "open")
      .gt("start_utc", nowISO)
      .lt("start_utc", in72)
      .order("start_utc", { ascending: true })
      .limit(10)

    const { data: ta168 } = await supabase
      .from("therapist_availability")
      .select("id, therapist_code, start_utc, end_utc, status")
      .eq("therapist_code", code)
      .eq("status", "open")
      .gt("start_utc", nowISO)
      .lt("start_utc", in168)
      .order("start_utc", { ascending: true })
      .limit(10)

    const { data: trow } = await supabase
      .from("therapists")
      .select("user_id, code, name")
      .eq("code", code)
      .maybeSingle()

    let profileId = null
    if (trow?.user_id) {
      const { data: prof } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("user_id", trow.user_id)
        .maybeSingle()
      profileId = prof?.id || null
    }

    let av72 = []
    let av168 = []
    if (profileId) {
      const r72 = await supabase
        .from("availability")
        .select("id, therapist_id, start_time, end_time, is_booked")
        .eq("therapist_id", profileId)
        .or("is_booked.is.null,is_booked.eq.false")
        .gt("start_time", nowISO)
        .lt("start_time", in72)
        .order("start_time", { ascending: true })
        .limit(10)
      av72 = r72.data || []

      const r168 = await supabase
        .from("availability")
        .select("id, therapist_id, start_time, end_time, is_booked")
        .eq("therapist_id", profileId)
        .or("is_booked.is.null,is_booked.eq.false")
        .gt("start_time", nowISO)
        .lt("start_time", in168)
        .order("start_time", { ascending: true })
        .limit(10)
      av168 = r168.data || []
    }

    return res.status(200).json({
      code,
      therapist: { code: trow?.code, name: trow?.name, user_id: trow?.user_id, profileId },
      therapist_availability: {
        in72_count: (ta72 || []).length,
        in72: ta72,
        in168_count: (ta168 || []).length,
        in168: ta168
      },
      availability: {
        in72_count: (av72 || []).length,
        in72: av72,
        in168_count: (av168 || []).length,
        in168: av168
      }
    })
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e || "unknown") })
  }
}
