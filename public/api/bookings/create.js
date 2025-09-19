// public/api/bookings/create.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { availabilityId, therapistCode, userId, startUTC, durationMins = 60 } = req.body || {};
    if (!therapistCode || !userId) {
      return res.status(400).json({ error: "therapistCode and userId required" });
    }

    // --- 路径 A：有 availabilityId 的原子预约（优先 RPC）
    if (availabilityId) {
      // 1) 先试 RPC（若存在）
      try {
        const { data, error } = await supabase.rpc("book_from_slot", {
          p_therapist_code: therapistCode,
          p_availability_id: availabilityId,
          p_user_id: userId
        });
        if (!error && data) {
          await writeBookingSuccessEvent(data);
          return res.status(200).json({ booking: data });
        }
        // 如果不是“函数不存在”，而是 slot 已被占，返回 409
        if (error?.message?.includes("slot_unavailable")) {
          return res.status(409).json({ error: "slot_unavailable" });
        }
        // 否则继续走回退实现
      } catch (_) {
        // 忽略，继续走无 RPC 回退
      }

      // 2) 无 RPC 回退：仅当 status=open 时更新为 booked（避免并发）
      const { data: slotRows, error: slotErr } = await supabase
        .from("therapist_availability")
        .select("id, start_utc, end_utc, status")
        .eq("id", availabilityId)
        .eq("therapist_code", therapistCode)
        .single();

      if (slotErr || !slotRows) {
        return res.status(404).json({ error: "slot_not_found" });
      }
      if (slotRows.status !== "open") {
        return res.status(409).json({ error: "slot_unavailable" });
      }

      // 原子“open -> booked”
      const { data: upd, error: updErr } = await supabase
        .from("therapist_availability")
        .update({ status: "booked" })
        .eq("id", availabilityId)
        .eq("status", "open")
        .select()
        .single();

      if (updErr || !upd) {
        // 没有更新到，说明已被抢
        return res.status(409).json({ error: "slot_unavailable" });
      }

      // 插入 booking
      const { data: booking, error: bkErr } = await supabase
        .from("bookings")
        .insert({
          therapist_code: therapistCode,
          user_id: userId,
          start_utc: slotRows.start_utc,
          duration_mins: durationMins
        })
        .select()
        .single();

      if (bkErr) {
        // 失败回滚可选：把可用时段状态改回 open（尝试，不阻塞）
        await supabase
          .from("therapist_availability")
          .update({ status: "open" })
          .eq("id", availabilityId)
          .eq("status", "booked");
        return res.status(500).json({ error: "create_booking_failed" });
      }

      await writeBookingSuccessEvent(booking);
      return res.status(200).json({ booking });
    }

    // --- 路径 B：没有 availabilityId（兼容型：直接按 startUTC 创建）
    if (!startUTC) {
      return res.status(400).json({ error: "startUTC required when no availabilityId" });
    }

    const { data: booking, error } = await supabase
      .from("bookings")
      .insert({
        therapist_code: therapistCode,
        user_id: userId,
        start_utc: startUTC,
        duration_mins: durationMins
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: "create_booking_failed" });
    }

    await writeBookingSuccessEvent(booking);
    return res.status(200).json({ booking });
  } catch (err) {
    return res.status(500).json({ error: "unexpected_error" });
  }
}

// 写入 BOOKING_SUCCESS 事件，供同会话抑制/摘要用
async function writeBookingSuccessEvent(booking) {
  try {
    await supabase.from("chats").insert({
      booking_id: booking.id,
      user_id: booking.user_id,
      role: "system",
      content: JSON.stringify({
        type: "BOOKING_SUCCESS",
        bookingId: booking.id,
        therapistCode: booking.therapist_code,
        startUTC: booking.start_utc,
        durationMins: booking.duration_mins,
        userId: booking.user_id
      })
    });
  } catch (_) {}
}
