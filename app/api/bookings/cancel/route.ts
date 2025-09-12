import { z } from 'zod';
import { sb } from '../../../../../lib/supabase';
import { TABLES } from '../../../../../lib/tables';
import { cors, preflight } from '../../../../../lib/cors';
import { json, ok, err, bad } from '../../../../../lib/http';

const Body = z.object({
  booking_id: z.string(),
  reason: z.string().optional(),
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
    const { data: updated, error: e2 } = await sb.from(TABLES.BOOKINGS)
      .update({ status: 'canceled', cancel_reason: b.reason || null })
      .eq('id', b.booking_id).select().maybeSingle();
    if (e2) throw e2;

    return reply(ok({ booking_id: updated.id, status: updated.status }).body, { status: 200 });
  } catch (e) {
    return reply(err(e).body, { status: 500 });
  }
}
