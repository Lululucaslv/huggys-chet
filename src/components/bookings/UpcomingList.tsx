import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listUserBookings, type UserBooking } from "../../lib/api/bookings.user";
import { toLocal, fmt } from "../../lib/tz";
import { LineSkeleton } from "../shared/Skeletons";
import { EmptyState } from "../shared/EmptyState";
import { useAuth } from "../../lib/auth/AuthProvider";
import { track } from "../../lib/analytics";
import { Calendar, AlertCircle } from "lucide-react";
import { BookingDrawer } from "./BookingDrawer";
import { RescheduleDialog } from "./RescheduleDialog";
import { CancelConfirm } from "./CancelConfirm";

export function UpcomingList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<UserBooking[]>([]);
  const [bookingDrawerOpen, setBookingDrawerOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<UserBooking | null>(null);
  const tz =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const payload = await listUserBookings({
        user_id: user?.id || "u_demo",
        therapist_code: "FAGHT34X",
        tz
      });
      if (!payload.ok) throw new Error("not ok");
      setItems(payload.data);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [user, tz]);

  return (
    <>
      {loading && (
        <div className="space-y-3">
          <LineSkeleton h={22} w="40%" />
          <LineSkeleton h={64} />
          <LineSkeleton h={64} />
        </div>
      )}

      {!loading && error && (
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
      )}

      {!loading && !error && !items.length && (
        <EmptyState
          icon={Calendar}
          title="No upcoming bookings"
          description="Add a time that works for you."
          action={
            <button
              className="h-10 px-4 rounded-[var(--radius-input)] border border-[var(--line)]"
              onClick={() => {
                setBookingDrawerOpen(true);
                track("booking_create_start", {});
              }}
            >
              Book now
            </button>
          }
        />
      )}

      {!loading && !error && items.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Upcoming bookings</h3>
            <button 
              className="text-sm text-[var(--muted)] hover:text-[var(--text)]"
              onClick={() => navigate('/app/bookings')}
            >
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
                        setSelectedBooking(b);
                        setRescheduleDialogOpen(true);
                        track("booking_reschedule_start", { id: b.id });
                      }}
                    >
                      Reschedule
                    </button>
                    <button
                      className="h-9 px-3 rounded-[var(--radius-input)] border border-[var(--line)]"
                      onClick={() => {
                        setSelectedBooking(b);
                        setCancelConfirmOpen(true);
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
      )}
      
      <BookingDrawer
        open={bookingDrawerOpen}
        onOpenChange={setBookingDrawerOpen}
        therapistCode="FAGHT34X"
        source="dashboard"
        onSuccess={() => {
          fetchBookings();
        }}
      />
      
      <RescheduleDialog
        open={rescheduleDialogOpen}
        onOpenChange={setRescheduleDialogOpen}
        booking={selectedBooking}
        onSuccess={() => {
          setSelectedBooking(null);
          fetchBookings();
        }}
      />
      
      <CancelConfirm
        open={cancelConfirmOpen}
        onOpenChange={setCancelConfirmOpen}
        booking={selectedBooking}
        onSuccess={() => {
          setSelectedBooking(null);
          fetchBookings();
        }}
      />
    </>
  );
}
