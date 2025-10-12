import { useState } from "react";
import { useAuth } from "../lib/auth/AuthProvider";
import { useBookings } from "../lib/hooks/useBookings";
import { BookingDrawer } from "../components/bookings/BookingDrawer";
import { RescheduleDialog } from "../components/bookings/RescheduleDialog";
import { CancelConfirm } from "../components/bookings/CancelConfirm";
import { LineSkeleton } from "../components/shared/Skeletons";
import { EmptyState } from "../components/shared/EmptyState";
import { type UserBooking } from "../lib/api/bookings.user";
import { toLocal, fmt } from "../lib/tz";
import { useTranslation } from "react-i18next";
import { Calendar } from "lucide-react";

const DEFAULT_THERAPIST_CODE = "FAGHT34X";

export default function Bookings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const { loading, error, items, refresh, optimisticRemove } = useBookings({
    user_id: user?.id || "",
    therapist_code: DEFAULT_THERAPIST_CODE,
    tz
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState<UserBooking | null>(null);
  const [cancelBooking, setCancelBooking] = useState<UserBooking | null>(null);

  const handleBookingCreated = () => {
    refresh();
  };

  const handleRescheduled = () => {
    refresh();
  };

  const handleCanceled = () => {
    if (cancelBooking) {
      optimisticRemove(cancelBooking.id);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{t("bookings.title", { defaultValue: "My Bookings" })}</h1>
          <button
            onClick={() => setDrawerOpen(true)}
            className="h-10 px-4 rounded-[var(--radius-input)] bg-[var(--brand-600)] text-white font-medium
                       hover:bg-[var(--brand-500)] transition-colors"
          >
            {t("bookings.new")}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && (
          <div className="space-y-4">
            <LineSkeleton h={120} />
            <LineSkeleton h={120} />
            <LineSkeleton h={120} />
          </div>
        )}

        {error && (
          <EmptyState
            icon={Calendar}
            title={t("bookings.loadFailed", { defaultValue: "Failed to load bookings" })}
            description={error}
            action={
              <button
                className="h-10 px-4 rounded-[var(--radius-input)] border border-[var(--line)]"
                onClick={() => location.reload()}
              >
                {t("bookings.reload", { defaultValue: "Reload" })}
              </button>
            }
          />
        )}

        {!loading && !error && items.length === 0 && (
          <EmptyState
            icon={Calendar}
            title={t("bookings.noBookings", { defaultValue: "No bookings yet" })}
            description={t("bookings.noBookingsDesc", { defaultValue: "Create your first booking to get started with your therapy sessions." })}
            action={
              <button
                onClick={() => setDrawerOpen(true)}
                className="h-10 px-6 rounded-[var(--radius-input)] bg-[var(--brand-600)] text-white font-medium
                           hover:bg-[var(--brand-500)] transition-colors"
              >
                {t("bookings.createFirst", { defaultValue: "Create booking" })}
              </button>
            }
          />
        )}

        {!loading && !error && items.length > 0 && (
          <div className="space-y-4">
            {items.map(booking => {
              const local = toLocal(booking.startUTC, tz);
              const end = toLocal(booking.endUTC, tz);
              const when = local ? fmt(local, "EEEE, MMMM dd, yyyy") : "—";
              const time = local && end ? `${fmt(local, "HH:mm")} - ${fmt(end, "HH:mm")}` : "—";
              
              return (
                <div
                  key={booking.id}
                  className="rounded-[var(--radius-card)] border border-[var(--line)] p-6 bg-[var(--card)]"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold mb-1">{when}</h3>
                      <p className="text-[var(--muted)] text-sm">{time}</p>
                      <p className="text-xs text-[var(--muted)] mt-2">
                        {t("bookings.therapist", { defaultValue: "Therapist" })}: {booking.therapist} · {booking.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setRescheduleBooking(booking)}
                        className="h-9 px-3 text-sm rounded-[var(--radius-input)] border border-[var(--line)]
                                   hover:bg-gray-50 transition-colors"
                      >
                        {t("bookings.reschedule")}
                      </button>
                      <button
                        onClick={() => setCancelBooking(booking)}
                        className="h-9 px-3 text-sm rounded-[var(--radius-input)] border border-red-200 text-red-600
                                   hover:bg-red-50 transition-colors"
                      >
                        {t("bookings.cancel")}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <BookingDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSuccess={handleBookingCreated}
        therapistCode={DEFAULT_THERAPIST_CODE}
        source="bookings.page"
      />

      <RescheduleDialog
        booking={rescheduleBooking}
        open={!!rescheduleBooking}
        onOpenChange={(open) => !open && setRescheduleBooking(null)}
        onSuccess={handleRescheduled}
      />

      <CancelConfirm
        booking={cancelBooking}
        open={!!cancelBooking}
        onOpenChange={(open) => !open && setCancelBooking(null)}
        onSuccess={handleCanceled}
      />
    </div>
  );
}
