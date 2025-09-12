import { z } from 'zod';
import { sb } from '../../../../../lib/supabase';
import { TABLES } from '../../../../../lib/tables';
import { cors, preflight } from '../../../../../lib/cors';
import { json, ok, err, bad } from '../../../../../lib/http';

const Body = z.object({
  user_id: z.string(),
  therapist_code: z.string().optional(),
});

export function OPTIONS(){ return preflight(); }

export async function POST(req: Request) {
  const reply = cors(req);
  try {
    const b = Body.parse(await json(req));
    const code = b.therapist_code || (process.env.THERAPIST_DEFAULT_CODE as string);

    const [profile, facts, summaries, tags] = await Promise.all([
      sb.from(TABLES.MEM_PROFILE).select('*').eq('user_id', b.user_id).eq('therapist_code', code).maybeSingle(),
      sb.from(TABLES.MEM_FACTS).select('*').eq('user_id', b.user_id).eq('therapist_code', code).order('created_at', { ascending: false }).limit(100),
      sb.from(TABLES.MEM_SUMMARIES).select('*').eq('user_id', b.user_id).eq('therapist_code', code).order('created_at', { ascending: false }).limit(50),
      sb.from(TABLES.MEM_TAGS).select('*').eq('user_id', b.user_id).eq('therapist_code', code).order('created_at', { ascending: false }).limit(100),
    ]).then(all => all.map((r: any) => r.data));

    return reply(ok({
      profile: (profile as any)?.data || {},
      facts: facts || [],
      summaries: summaries || [],
      tags: (tags || []).map((t: any) => t.tag),
    }).body, { status: 200 });
  } catch (e) {
    return reply(err(e).body, { status: 500 });
  }
}
