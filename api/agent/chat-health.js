export default async function handler(req, res) {
  try {
    const hasOpenAI = !!process.env.OPENAI_API_KEY
    const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY

    res.status(200).json({
      ok: true,
      hasOpenAI,
      hasSupabase,
      ts: Date.now()
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}
