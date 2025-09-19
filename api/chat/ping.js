export const runtime = 'nodejs'

export default async function handler(req, res) {
  try {
    const ok = !!process.env.OPENAI_API_KEY && (!!process.env.NEXT_PUBLIC_SUPABASE_URL || !!process.env.SUPABASE_URL) && !!process.env.SUPABASE_SERVICE_ROLE_KEY
    res.status(200).json({
      ok,
      env: {
        openai: !!process.env.OPENAI_API_KEY,
        supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL || !!process.env.SUPABASE_URL,
        supabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      },
      route: 'api/chat/ping'
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
}
