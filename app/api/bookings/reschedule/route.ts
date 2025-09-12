import { z } from 'zod';
import { sb } from '../../../../../lib/supabase';
import { TABLES } from '../../../../../lib/tables';
import { cors, preflight } from '../../../../../lib/cors';
import { json, ok, err, bad } from '../../../../../lib/http';
import { rangeDisplay } from '../../../../../lib/dates';
import { getTherapistTZ } from '../../../../../lib/therapists';

const Body = z.object({
  booking_id: z.string(),
  to: z.object({ availability_id: z.string() }),
  user_tz: z.string().optional(),
});

export function OPTIONS(){ return preflight(); }

export async function POST(req: Request) {
  const reply = cors(req);
  try {
    const b = Body.parse(await json(req));
    const { data: bk, error } = await sb.from(TABLES.BOOKINGS).select('*').eq('id', b.booking_id).maybeSingle();
    if (error) throw error;
    if (!bk) return reply(bad('booking_not_found', 404).body, { status: 404 });

    if (bk.availability_id) {
      await sb.from(TABLES.AVAIL).update({ booked: false }).eq('id', bk.availability_id);
    }

    const { data: newSlot, error: e2 } = await sb.from(TABLES.AVAIL).update({ booked: true }).eq('id', b.to.availability_id).select().maybeSingle();
    if (e2) throw e2;
    if (!newSlot) return reply(bad('availability_not_found', 404).body, { status: 404 });

    const { data: updated, error: e3 } = await sb.from(TABLES.BOOKINGS)
      .update({ availability_id: newSlot.id, therapist_code: newSlot.therapist_code, status: 'scheduled' })
      .eq('id', b.booking_id)
      .select().maybeSingle();
    if (e3) throw e3;

    const therapistTZ = await getTherapistTZ(newSlot.therapist_code);
    const result = {
      booking_id: updated.id,
      therapist_code: updated.therapist_code,
      slot: {
        availabilityId: newSlot.id,
        startUTC: newSlot.start_utc,
        endUTC: newSlot.end_utc,
        display: {
          forTherapist: rangeDisplay(newSlot.start_utc, newSlot.end_utc, therapistTZ || undefined),
          forUser: rangeDisplay(newSlot.start_utc, newSlot.end_utc, b.user_tz),
        },
      },
    };
    return reply(ok(result).body, { status: 200 });
  } catch (e) {
    return reply(err(e).body, { status: 500 });
  }
}
