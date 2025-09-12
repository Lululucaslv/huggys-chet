import { z } from 'zod';
import { sb } from '../../../../../lib/supabase';
import { TABLES } from '../../../../../lib/tables';
import { cors, preflight } from '../../../../../lib/cors';
import { json, ok, err, bad } from '../../../../../lib/http';

const Body = z.object({
  booking_id: z.string(),
  limit_messages: z.number().default(20),
});

export function OPTIONS(){ return preflight(); }

export async function POST(req: Request) {
  const reply = cors(req);
  try {
    const b = Body.parse(await json(req));
    const { data: bk, error } = await sb.from(TABLES.BOOKINGS).select('*').eq('id', b.booking_id).maybeSingle();
    if (error) throw error;
    if (!bk) return reply(bad('booking_not_found', 404).body, { status: 404 });

    const [profile, facts, summaries, tags] = await Promise.all([
      sb.from(TABLES.MEM_PROFILE).select('*').eq('user_id', bk.user_id).eq('therapist_code', bk.therapist_code).maybeSingle(),
      sb.from(TABLES.MEM_FACTS).select('*').eq('user_id', bk.user_id).eq('therapist_code', bk.therapist_code).order('created_at', { ascending: false }).limit(100),
      sb.from(TABLES.MEM_SUMMARIES).select('*').eq('user_id', bk.user_id).eq('therapist_code', bk.therapist_code).order('created_at', { ascending: false }).limit(20),
      sb.from(TABLES.MEM_TAGS).select('*').eq('user_id', bk.user_id).eq('therapist_code', bk.therapist_code).order('created_at', { ascending: false }).limit(100),
    ]).then(all => all.map((r: any) => r.data));

    return reply(ok({
      booking: bk,
      profile: (profile as any)?.data || {},
      facts: facts || [],
      summaries: summaries || [],
      tags: (tags || []).map((t: any) => t.tag),
      messages: [],
    }).body, { status: 200 });
  } catch (e) {
    return reply(err(e).body, { status: 500 });
  }
}
