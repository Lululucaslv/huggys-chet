import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { useSlots } from "../../lib/hooks/useSlots";
import { toLocal, fmt } from "../../lib/tz";
import { rescheduleBooking, type UserBooking } from "../../lib/api/bookings.user";
import { successToast, errorToast } from "../../lib/toasts";
import { useAuth } from "../../lib/auth/AuthProvider";
import { useAuthGate } from "../../lib/useAuthGate";
import { track } from "../../lib/analytics";
import { useTranslation } from "react-i18next";
import { addDays, format } from "date-fns";
import { LineSkeleton } from "../shared/Skeletons";
import { getTzPref } from "../../lib/tzPref";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  booking: UserBooking | null;
  onSuccess: () => void;
};

export function RescheduleDialog({ open, onOpenChange, booking, onSuccess }: Props) {
  const { t } = useTranslation();
  const tz = useMemo(() => getTzPref(), []);
  const { user } = useAuth();
  const { requireAuth } = useAuthGate();
  const [selectedDate, setSelectedDate] = useState<Date>(addDays(new Date(), 1));
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { loading, error, slots } = useSlots({
    therapist_code: booking?.therapistCode || "FAGHT34X",
    date: selectedDate,
    tz
  });

  async function onConfirm() {
    if (!booking || !selectedSlotId) return;

    const allowed = requireAuth({ type: "BOOK_RESCHEDULE", payload: { onAllow: onConfirm } });
    if (!allowed.allowed) return;

    setSubmitting(true);
    try {
      const res = await rescheduleBooking({
        booking_id: booking.id,
        user_id: user?.id || "u_demo",
        therapist_code: booking.therapistCode,
        new_availability_id: selectedSlotId,
        tz,
        lang: "en"
      });
      
      if (res?.ok === false && res?.status === 409) {
        errorToast(t("bookings.conflict"));
        track("booking_reschedule_fail", { status: 409, booking_id: booking.id, new_availability_id: selectedSlotId });
        
        const currentIndex = slots.findIndex(s => s.availabilityId === selectedSlotId);
        if (currentIndex >= 0 && currentIndex + 1 < slots.length) {
          setSelectedSlotId(slots[currentIndex + 1].availabilityId);
        } else {
          setSelectedSlotId(null);
        }
        return;
      }
      
      if (res?.ok === false) {
        errorToast(t("bookings.rescheduleFailed", { defaultValue: `Failed to reschedule (${res.status || "unknown"})` }));
        track("booking_reschedule_fail", { status: res.status || "unknown" });
        return;
      }
      
      successToast(t("bookings.successReschedule"));
      track("booking_reschedule_success", { booking_id: booking.id, new_availability_id: selectedSlotId });
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      errorToast(e?.message || t("bookings.rescheduleFailed", { defaultValue: "Failed to reschedule" }));
    } finally {
      setSubmitting(false);
    }
  }

  if (!booking) return null;

  const curLocal = toLocal(booking.startUTC, tz);
  const curLabel = curLocal ? fmt(curLocal, "LLL dd (ccc) HH:mm") : booking.startUTC;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle tabIndex={-1}>{t("bookings.reschedule")}</DialogTitle>
          <DialogDescription>
            {t("bookings.currentBooking", { defaultValue: "Current booking" })}: {curLabel} ({tz})
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between mt-2">
          <button
            className="h-9 px-3 rounded-[var(--radius-input)] border border-[var(--line)] hover:bg-gray-50"
            onClick={() => {
              setSelectedDate(d => addDays(d, -1));
              setSelectedSlotId(null);
            }}
          >
            ← {t("bookings.prevDay", { defaultValue: "Prev" })}
          </button>
          <div className="text-sm font-medium">{format(selectedDate, "MMM dd, yyyy")}</div>
          <button
            className="h-9 px-3 rounded-[var(--radius-input)] border border-[var(--line)] hover:bg-gray-50"
            onClick={() => {
              setSelectedDate(d => addDays(d, 1));
              setSelectedSlotId(null);
            }}
          >
            {t("bookings.nextDay", { defaultValue: "Next" })} →
          </button>
        </div>

        <div className="mt-3">
          <div className="text-sm text-[var(--muted)] mb-2">
            {t("bookings.availableSlots")} ({tz})
          </div>
          {loading && <LineSkeleton h={200} />}
          {error && <div className="text-sm text-red-600">{error}</div>}
          {!loading && !error && slots.length === 0 && (
            <div className="text-sm text-[var(--muted)] text-center py-8">
              {t("bookings.noSlots")}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {slots.map(s => {
              const local = toLocal(s.startUTC, tz);
              const end = toLocal(s.endUTC, tz);
              const label = local ? fmt(local, "LLL dd (ccc) HH:mm") : s.display || s.startUTC;
              const to = end ? fmt(end, "HH:mm") : "";
              const active = selectedSlotId === s.availabilityId;
              return (
                <button
                  key={s.availabilityId}
                  aria-label={`${t("bookings.selectSlot", { defaultValue: "Select slot" })} ${label}`}
                  className={`h-10 rounded-[var(--radius-input)] border px-3 text-sm text-left
                    ${active ? "bg-[var(--brand-600)] text-white border-transparent"
                            : "border-[var(--line)] hover:bg-gray-50"}`}
                  onClick={() => setSelectedSlotId(s.availabilityId)}
                >
                  {label}{to ? `–${to}` : ""}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            className="h-10 px-4 rounded-[var(--radius-input)] border border-[var(--line)] hover:bg-gray-50"
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </button>
          <button
            className="h-10 px-4 rounded-[var(--radius-input)] text-white bg-[var(--brand-600)] hover:bg-[var(--brand-500)] disabled:opacity-60"
            disabled={!selectedSlotId || submitting}
            onClick={onConfirm}
          >
            {submitting ? t("bookings.rescheduling", { defaultValue: "Rescheduling..." }) : t("bookings.confirm")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
