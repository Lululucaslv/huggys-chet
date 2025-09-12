import { z } from 'zod';
import { sb } from '../../../../lib/supabase';
import { TABLES } from '../../../../lib/tables';
import { cors, preflight } from '../../../../lib/cors';
import { json, ok, err } from '../../../../lib/http';
import { parseLocalToUTC, rangeDisplay } from '../../../../lib/dates';
import { getTherapistTZ } from '../../../../lib/therapists';

const Body = z.object({
  therapist_code: z.string().optional(),
  time_ranges: z.array(z.object({
    start_local: z.string(),
    end_local: z.string(),
    tz: z.string().optional(),
  })),
  user_tz: z.string().optional(),
});

export function OPTIONS() { return preflight(); }

export async function POST(req: Request) {
  const reply = cors(req);
  try {
    const b = Body.parse(await json(req));
    const code = b.therapist_code || (process.env.THERAPIST_DEFAULT_CODE as string);
    const therapistTZ = await getTherapistTZ(code);

    const rows = b.time_ranges.map(r => {
      const sUTC = parseLocalToUTC(r.start_local, r.tz).toISO({ suppressMilliseconds: true })!;
      const eUTC = parseLocalToUTC(r.end_local, r.tz).toISO({ suppressMilliseconds: true })!;
      return { therapist_code: code, start_utc: sUTC, end_utc: eUTC, booked: false };
    });

    const { data, error } = await sb.from(TABLES.AVAIL).upsert(rows as any, { onConflict: 'therapist_code,start_utc,end_utc' }).select();
    if (error) throw error;

    const slots = (data || []).map((d: any) => ({
      availabilityId: d.id,
      startUTC: d.start_utc,
      endUTC: d.end_utc,
      display: {
        forTherapist: rangeDisplay(d.start_utc, d.end_utc, therapistTZ || undefined),
        forUser: rangeDisplay(d.start_utc, d.end_utc, b.user_tz),
      },
    }));

    return reply(ok({ slots }).body, { status: 200 });
  } catch (e) {
    return reply(err(e).body, { status: 500 });
  }
}
