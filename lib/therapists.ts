import { sb } from './supabase';
import { TABLES } from './tables';

export async function getTherapistTZ(code?: string | null) {
  const c = code || (process.env.THERAPIST_DEFAULT_CODE as string);
  const { data, error } = await sb
    .from(TABLES.THERAPISTS)
    .select('timezone')
    .eq('code', c)
    .maybeSingle();

  if (error) throw error;
  return (data?.timezone as string) || null;
}
