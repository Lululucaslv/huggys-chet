import { useEffect, useState } from "react";
import { listBookings, type Booking } from "../../lib/api/bookings";
import { toLocal, fmt } from "../../lib/tz";
import { LineSkeleton } from "../shared/Skeletons";
import { EmptyState } from "../shared/EmptyState";
import { useAuth } from "../../lib/auth/AuthProvider";
import { useAuthGate } from "../../lib/useAuthGate";
import { track } from "../../lib/analytics";
import { Calendar, AlertCircle } from "lucide-react";

export function UpcomingList() {
  const { user } = useAuth();
  const { requireAuth } = useAuthGate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Booking[]>([]);
  const tz =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const today = new Date();
        const from = new Date(today);
        from.setHours(0, 0, 0, 0);
        const to = new Date(today);
        to.setDate(to.getDate() + 30);
        to.setHours(23, 59, 59, 999);
        const payload = await listBookings({
          user_id: user?.id || "u_demo",
          therapist_code: "FAGHT34X",
          tz,
          date_from: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")} 00:00`,
          date_to: `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, "0")}-${String(to.getDate()).padStart(2, "0")} 23:59`,
          lang: "en-US"
        });
        if (!payload.ok) throw new Error("not ok");
        setItems(payload.data);
        setError(null);
      } catch (e: any) {
        setError(e?.message || "Load failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [user, tz]);

  if (loading)
    return (
      <div className="space-y-3">
        <LineSkeleton h={22} w="40%" />
        <LineSkeleton h={64} />
        <LineSkeleton h={64} />
      </div>
    );

  if (error)
    return (
      <EmptyState
        icon={AlertCircle}
        title="Failed to load bookings"
        description={error}
        action={
          <button className="underline" onClick={() => location.reload()}>
            Reload
          </button>
        }
      />
    );

  if (!items.length)
    return (
      <EmptyState
        icon={Calendar}
        title="No upcoming bookings"
        description="Add a time that works for you."
        action={
          <button
            className="h-10 px-4 rounded-[var(--radius-input)] border border-[var(--line)]"
            onClick={() => {
              const allowed = requireAuth({
                type: "BOOK_CREATE",
                payload: { onAllow: () => track("booking_create_start", {}) }
              });
              if (allowed.allowed) track("booking_create_start", {});
            }}
          >
            Book now
          </button>
        }
      />
    );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Upcoming bookings</h3>
        <button className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
          View all
        </button>
      </div>
      <ul className="divide-y divide-[var(--line)] rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--card)]">
        {items.map((b) => {
          const local = toLocal(b.startUTC, tz);
          const end = toLocal(b.endUTC, tz);
          const when = local ? fmt(local, "LLL dd (ccc) HH:mm") : "—";
          const whenTo = end ? fmt(end, "HH:mm") : "—";
          return (
            <li key={b.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">
                  {when}–{whenTo}
                </div>
                <div className="text-sm text-[var(--muted)]">
                  {b.therapist} · {b.status}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="h-9 px-3 rounded-[var(--radius-input)] border border-[var(--line)]"
                  onClick={() => {
                    const allowed = requireAuth({
                      type: "BOOK_RESCHEDULE",
                      payload: {
                        onAllow: () =>
                          track("booking_reschedule_start", { id: b.id })
                      }
                    });
                    if (allowed.allowed)
                      track("booking_reschedule_start", { id: b.id });
                  }}
                >
                  Reschedule
                </button>
                <button
                  className="h-9 px-3 rounded-[var(--radius-input)] border border-[var(--line)]"
                  onClick={() => {
                    const allowed = requireAuth({
                      type: "BOOK_CANCEL",
                      payload: {
                        onAllow: () =>
                          track("booking_cancel_start", { id: b.id })
                      }
                    });
                    if (allowed.allowed)
                      track("booking_cancel_start", { id: b.id });
                  }}
                >
                  Cancel
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
