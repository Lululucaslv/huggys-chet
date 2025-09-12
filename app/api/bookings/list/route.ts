import { z } from 'zod';
import { sb } from '../../../../../lib/supabase';
import { TABLES } from '../../../../../lib/tables';
import { cors, preflight } from '../../../../../lib/cors';
import { json, ok, err } from '../../../../../lib/http';
import { DateTime } from 'luxon';
import { getTZ, rangeDisplay } from '../../../../../lib/dates';
import { getTherapistTZ } from '../../../../../lib/therapists';

const Body = z.object({
  therapistHint: z.string().optional(),
  timeHint: z.string().optional(),
  lang: z.string().optional(),
  hours: z.number().default(96),
  limit: z.number().default(8),
  userid: z.string().optional(),
  user_tz: z.string().optional(),
});

export function OPTIONS(){ return preflight(); }

export async function POST(req: Request) {
  const reply = cors(req);
  try {
    const b = Body.parse(await json(req));
    const code = (b.therapistHint?.trim() || process.env.THERAPIST_DEFAULT_CODE) as string;
    const therapistTZ = await getTherapistTZ(code);
    const userTZ = getTZ(b.user_tz || undefined);

    const now = DateTime.utc();
    const until = now.plus({ hours: b.hours });

    const { data, error } = await sb
      .from(TABLES.AVAIL)
      .select('id, start_utc, end_utc, booked, therapist_code')
      .eq('therapist_code', code)
      .gte('start_utc', now.toISO())
      .lte('end_utc', until.toISO())
      .eq('booked', false)
      .order('start_utc', { ascending: true })
      .limit(b.limit);

    if (error) throw error;

    const slots = (data || []).map((d: any) => ({
      availabilityId: d.id,
      booked: d.booked,
      startUTC: d.start_utc,
      endUTC: d.end_utc,
      display: {
        forTherapist: rangeDisplay(d.start_utc, d.end_utc, therapistTZ || undefined),
        forUser: rangeDisplay(d.start_utc, d.end_utc, userTZ),
      },
    }));

    return reply(ok({ slots, therapist_code: code }).body, { status: 200 });
  } catch (e) {
    return reply(err(e).body, { status: 500 });
  }
}
