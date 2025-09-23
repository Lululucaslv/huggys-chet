import { createClient } from '@supabase/supabase-js'

export function getServiceSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase env')
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function getAuthUserIdFromRequest(req, supabase) {
  let token = null
  const authHeader = req.headers['authorization'] || req.headers['Authorization']
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice('Bearer '.length).trim()
  }
  if (!token) {
    const cookie = req.headers.cookie || ''
    const match = cookie.match(/sb-access-token=([^;]+)/)
    if (match) token = decodeURIComponent(match[1])
  }
  if (!token) {
    const error = new Error('Unauthorized: missing access token')
    error.code = 401
    throw error
  }
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user?.id) {
    const err = new Error('Unauthorized: invalid token')
    err.code = 401
    throw err
  }
  return data.user.id
}

export async function requireTherapistProfileId(supabase, userIdText) {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('id, life_status')
    .eq('user_id', userIdText)
    .single()
  if (error || !profile) {
    const err = new Error('Profile not found')
    err.code = 404
    throw err
  }
  if (String(profile.life_status || '').toLowerCase() !== 'therapist') {
    const err = new Error('Forbidden: not a therapist')
    err.code = 403
    throw err
  }
  return profile.id
}
