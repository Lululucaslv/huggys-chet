import { z } from 'zod';
import { sb } from '../../../../../lib/supabase';
import { TABLES } from '../../../../../lib/tables';
import { cors, preflight } from '../../../../../lib/cors';
import { json, ok, err, bad, bearer, needAuth } from '../../../../../lib/http';

const Body = z.object({
  user_id: z.string(),
  therapist_code: z.string().optional(),
  booking_id: z.string().optional(),

  profile_patch: z.record(z.any()).optional(),
  facts_add: z.array(z.object({ text: z.string(), from: z.string().optional() })).optional(),
  facts_remove: z.array(z.object({ id: z.string() })).optional(),
  summary_add: z.array(z.object({ text: z.string(), from: z.string().optional() })).optional(),
  summary_remove: z.array(z.object({ id: z.string() })).optional(),
  tags_add: z.array(z.string()).optional(),
  tags_remove: z.array(z.string()).optional(),

  source: z.record(z.any()).optional(),
});

export function OPTIONS(){ return preflight(); }

export async function POST(req: Request) {
  const reply = cors(req);
  try {
    if (bearer(req) !== process.env.MEMORY_WRITE_KEY) return reply(needAuth().body, { status: 401 });

    const b = Body.parse(await json(req));
    const code = b.therapist_code || (process.env.THERAPIST_DEFAULT_CODE as string);
    const user_id = b.user_id;

    if (b.profile_patch) {
      const { data: cur } = await sb.from(TABLES.MEM_PROFILE)
        .select('*').eq('user_id', user_id).eq('therapist_code', code).maybeSingle();
      const newdata = { ...((cur as any)?.data || {}), ...b.profile_patch };
      await sb.from(TABLES.MEM_PROFILE).upsert(
        { user_id, therapist_code: code, data: newdata }, { onConflict: 'user_id,therapist_code' }
      );
    }

    if (b.facts_add?.length) {
      await sb.from(TABLES.MEM_FACTS)
        .insert(b.facts_add.map(f => ({ user_id, therapist_code: code, text: f.text, source: f.from || 'llm' })));
    }
    if (b.facts_remove?.length) {
      await sb.from(TABLES.MEM_FACTS).delete().in('id', b.facts_remove.map(x => x.id));
    }

    if (b.summary_add?.length) {
      await sb.from(TABLES.MEM_SUMMARIES)
        .insert(b.summary_add.map(s => ({ user_id, therapist_code: code, text: s.text, source: s.from || 'llm' })));
    }
    if (b.summary_remove?.length) {
      await sb.from(TABLES.MEM_SUMMARIES).delete().in('id', b.summary_remove.map(x => x.id));
    }

    if (b.tags_add?.length) {
      await sb.from(TABLES.MEM_TAGS)
        .insert(b.tags_add.map(tag => ({ user_id, therapist_code: code, tag })));
    }
    if (b.tags_remove?.length) {
      await sb.from(TABLES.MEM_TAGS)
        .delete()
        .eq('user_id', user_id).eq('therapist_code', code)
        .in('tag', b.tags_remove);
    }

    return reply(ok({ ok: true }).body, { status: 200 });
  } catch (e) {
    return reply(err(e).body, { status: 500 });
  }
}
