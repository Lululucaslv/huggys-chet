import { z } from 'zod';
import { sb } from '../../../../lib/supabase';
import { TABLES } from '../../../../lib/tables';
import { cors, preflight } from '../../../../lib/cors';
import { json, ok, err, bad } from '../../../../lib/http';
import { parseLocalToUTC, rangeDisplay } from '../../../../lib/dates';
import { getTherapistTZ } from '../../../../lib/therapists';

const Body = z.union([
  z.object({
    availability_id: z.string(),
    update: z.object({
      start_local: z.string().optional(),
      end_local: z.string().optional(),
      tz: z.string().optional(),
    }),
    user_tz: z.string().optional(),
  }),
  z.object({
    therapist_code: z.string().optional(),
    from: z.object({ start_utc: z.string(), end_utc: z.string() }),
    to: z.object({ start_local: z.string(), end_local: z.string(), tz: z.string().optional() }),
    user_tz: z.string().optional(),
  }),
]);

export function OPTIONS(){ return preflight(); }

export async function POST(req: Request) {
  const reply = cors(req);
  try {
    const b = Body.parse(await json(req));

    let rec: any;
    if ('availability_id' in b) {
      const { data, error } = await sb.from(TABLES.AVAIL).select('*').eq('id', b.availability_id).maybeSingle();
      if (error) throw error;
      if (!data) return reply(bad('not_found', 404).body, { status: 404 });

      const start_utc = b.update.start_local ? parseLocalToUTC(b.update.start_local, b.update.tz).toISO({ suppressMilliseconds:true }) : data.start_utc;
      const end_utc   = b.update.end_local   ? parseLocalToUTC(b.update.end_local, b.update.tz).toISO({ suppressMilliseconds:true }) : data.end_utc;

      const { data: upd, error: e2 } = await sb.from(TABLES.AVAIL).update({ start_utc, end_utc }).eq('id', data.id).select().maybeSingle();
      if (e2) throw e2;
      rec = upd;
    } else {
      const code = b.therapist_code || (process.env.THERAPIST_DEFAULT_CODE as string);
      const start_utc = parseLocalToUTC(b.to.start_local, b.to.tz).toISO({ suppressMilliseconds:true })!;
      const end_utc   = parseLocalToUTC(b.to.end_local, b.to.tz).toISO({ suppressMilliseconds:true })!;

      const { data, error } = await sb.from(TABLES.AVAIL)
        .update({ start_utc, end_utc })
        .eq('therapist_code', code)
        .eq('start_utc', (b as any).from.start_utc)
        .eq('end_utc', (b as any).from.end_utc)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) return reply(bad('not_found', 404).body, { status: 404 });
      rec = data;
    }

    const therapistTZ = await getTherapistTZ(rec.therapist_code);
    const result = {
      availabilityId: rec.id,
      startUTC: rec.start_utc,
      endUTC: rec.end_utc,
      display: {
        forTherapist: rangeDisplay(rec.start_utc, rec.end_utc, therapistTZ || undefined),
        forUser: rangeDisplay(rec.start_utc, rec.end_utc, ('availability_id' in b ? (b as any).user_tz : (b as any).user_tz)),
      },
    };
    return reply(ok(result).body, { status: 200 });
  } catch (e) {
    return reply(err(e).body, { status: 500 });
  }
}
