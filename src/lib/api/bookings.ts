const MOCK = true;

export type Booking = {
  id: string;
  therapist: string;
  startUTC: string;
  endUTC: string;
  status: "confirmed" | "rescheduled" | "canceled";
};

export async function listBookings(p: {
  user_id: string;
  therapist_code: string;
  tz: string;
  date_from: string;
  date_to: string;
  lang: string;
}): Promise<{ ok: boolean; data: Booking[] }> {
  if (MOCK) {
    return {
      ok: true,
      data: [
        {
          id: "bk_123",
          therapist: "Therapist A",
          startUTC: "2025-10-15T22:00:00Z",
          endUTC: "2025-10-15T23:00:00Z",
          status: "confirmed"
        },
        {
          id: "bk_456",
          therapist: "Therapist B",
          startUTC: "2025-10-20T17:00:00Z",
          endUTC: "2025-10-20T18:00:00Z",
          status: "confirmed"
        }
      ]
    };
  }
  const r = await fetch("/api/bookings/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p)
  });
  if (!r.ok) throw new Error("bookings/list failed");
  return r.json();
}

export async function cancelBooking(p: {
  booking_id: string;
  user_id: string;
  therapist_code: string;
  tz: string;
  lang: string;
}) {
  const r = await fetch("/api/bookings/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p)
  });
  if (!r.ok) throw new Error("bookings/cancel failed");
  return r.json();
}

export async function rescheduleBooking() {
}
