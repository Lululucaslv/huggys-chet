import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { cancelBooking, type UserBooking } from "../../lib/api/bookings.user";
import { useAuth } from "../../lib/auth/AuthProvider";
import { useAuthGate } from "../../lib/useAuthGate";
import { successToast, errorToast } from "../../lib/toasts";
import { toLocal, fmt } from "../../lib/tz";
import { track } from "../../lib/analytics";
import { useTranslation } from "react-i18next";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  booking: UserBooking | null;
  onSuccess: () => void;
};

export function CancelConfirm({ open, onOpenChange, booking, onSuccess }: Props) {
  const { t } = useTranslation();
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);
  const { user } = useAuth();
  const { requireAuth } = useAuthGate();
  const [submitting, setSubmitting] = useState(false);

  async function onConfirm() {
    if (!booking) return;
    
    const allowed = requireAuth({ type: "BOOK_CANCEL", payload: { onAllow: onConfirm } });
    if (!allowed.allowed) return;

    setSubmitting(true);
    try {
      const res = await cancelBooking({
        booking_id: booking.id,
        user_id: user?.id || "u_demo",
        therapist_code: booking.therapistCode,
        tz,
        lang: "en"
      });
      
      if (res?.ok === false) {
        errorToast(t("bookings.cancelFailed", { defaultValue: "Failed to cancel booking" }));
        track("booking_cancel_fail", { status: "unknown", booking_id: booking.id });
        return;
      }
      
      successToast(t("bookings.successCancel"));
      track("booking_cancel_success", { booking_id: booking.id });
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      errorToast(e?.message || t("bookings.cancelFailed", { defaultValue: "Failed to cancel" }));
    } finally {
      setSubmitting(false);
    }
  }

  if (!booking) return null;

  const local = toLocal(booking.startUTC, tz);
  const label = local ? fmt(local, "LLL dd (ccc) HH:mm") : booking.startUTC;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{t("bookings.confirmCancelTitle")}</DialogTitle>
          <DialogDescription>
            {label} ({tz})
            <br />
            {t("bookings.confirmCancelDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            className="h-10 px-4 rounded-[var(--radius-input)] border border-[var(--line)] hover:bg-gray-50"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t("bookings.keepBooking", { defaultValue: "Keep booking" })}
          </button>
          <button
            className="h-10 px-4 rounded-[var(--radius-input)] text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? t("bookings.canceling", { defaultValue: "Canceling..." }) : t("bookings.cancel")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
