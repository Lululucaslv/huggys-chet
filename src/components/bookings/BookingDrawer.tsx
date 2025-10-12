import React, { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { useSlots } from "../../lib/hooks/useSlots";
import { toLocal, fmt } from "../../lib/tz";
import { createBooking } from "../../lib/api/bookings.user";
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
  therapistCode: string;
  source?: string;
  onSuccess: () => void;
};

export function BookingDrawer({ open, onOpenChange, therapistCode, source = "bookings.page", onSuccess }: Props) {
  const { t } = useTranslation();
  const tz = useMemo(() => getTzPref(), []);
  const { user } = useAuth();
  const { requireAuth } = useAuthGate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { loading, error, slots } = useSlots({
    therapist_code: therapistCode,
    date: selectedDate,
    tz
  });

  React.useEffect(() => {
    if (open) {
      track("booking_drawer_open", { source });
    }
  }, [open, source]);

  async function handleCreateBooking() {
    if (!selectedSlotId) return;

    const allowed = requireAuth({
      type: "BOOK_CREATE",
      payload: {
        therapistCode,
        slotId: selectedSlotId,
        onAllow: performCreate
      }
    });

    if (allowed.allowed) {
      await performCreate();
    }
  }

  async function performCreate() {
    if (!selectedSlotId) return;

    setCreating(true);
    try {
      const res = await createBooking({
        user_id: user?.id || "u_demo",
        therapist_code: therapistCode,
        availability_id: selectedSlotId,
        tz,
        lang: "en",
        source
      });

      if (res?.ok === false && res?.status === 409) {
        errorToast(t("bookings.conflict"));
        track("booking_create_fail", { status: 409, availability_id: selectedSlotId });
        
        const currentIndex = slots.findIndex(s => s.availabilityId === selectedSlotId);
        if (currentIndex >= 0 && currentIndex + 1 < slots.length) {
          setSelectedSlotId(slots[currentIndex + 1].availabilityId);
        } else {
          setSelectedSlotId(null);
        }
        return;
      }

      if (res?.ok === false) {
        errorToast(t("bookings.createFailed", { defaultValue: `Failed to create booking (${res.status || "unknown"})` }));
        track("booking_create_fail", { status: res.status || "unknown" });
        return;
      }

      successToast(t("bookings.successCreate"));
      track("booking_create_success", { availability_id: selectedSlotId });
      onOpenChange(false);
      setSelectedDate(new Date());
      setSelectedSlotId(null);
      onSuccess();
    } catch (e: any) {
      errorToast(e?.message || t("bookings.createFailed", { defaultValue: "Failed to create booking" }));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle tabIndex={-1}>{t("bookings.new")}</SheetTitle>
          <SheetDescription>
            {t("bookings.selectDateAndSlot", { defaultValue: "Select a date and available time slot" })}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-3">{t("bookings.pickDate")}</label>
            <div className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3, 4, 5, 6, 7].map(days => {
                const date = addDays(new Date(), days);
                const isSelected = format(date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
                return (
                  <button
                    key={days}
                    onClick={() => {
                      setSelectedDate(date);
                      setSelectedSlotId(null);
                    }}
                    className={`py-3 px-2 rounded-[var(--radius-input)] border text-sm
                               ${isSelected
                                 ? "bg-[var(--brand-600)] text-white border-[var(--brand-600)]"
                                 : "border-[var(--line)] hover:bg-gray-50"}`}
                  >
                    <div className="font-medium">{format(date, "EEE")}</div>
                    <div className="text-xs mt-1">{format(date, "MMM d")}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-3">{t("bookings.availableSlots")}</label>
            {loading && <LineSkeleton h={300} />}
            {error && <div className="text-red-600 text-sm">{error}</div>}
            {!loading && !error && slots.length === 0 && (
              <div className="text-center py-12 text-[var(--muted)]">
                {t("bookings.noSlots")}
              </div>
            )}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {slots.map(slot => {
                const local = toLocal(slot.startUTC, tz);
                const end = toLocal(slot.endUTC, tz);
                const label = local ? fmt(local, "LLL dd (ccc) HH:mm") : slot.display || slot.startUTC;
                const to = end ? fmt(end, "HH:mm") : "";
                const active = selectedSlotId === slot.availabilityId;
                return (
                  <button
                    key={slot.availabilityId}
                    onClick={() => setSelectedSlotId(slot.availabilityId)}
                    aria-label={`${t("bookings.selectSlot", { defaultValue: "Select slot" })} ${label}`}
                    className={`w-full p-4 rounded-[var(--radius-input)] border text-left transition-colors
                               ${active
                                 ? "bg-[var(--brand-50)] border-[var(--brand-600)]"
                                 : "border-[var(--line)] hover:bg-gray-50"}`}
                  >
                    <div className="font-medium">{label}</div>
                    <div className="text-sm text-[var(--muted)] mt-1">
                      {local ? fmt(local, "HH:mm") : ""}{to ? ` - ${to}` : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => onOpenChange(false)}
            disabled={creating}
            className="flex-1 h-12 rounded-[var(--radius-input)] border border-[var(--line)]
                       hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleCreateBooking}
            disabled={!selectedSlotId || creating}
            className="flex-1 h-12 rounded-[var(--radius-input)] bg-[var(--brand-600)] text-white font-medium
                       hover:bg-[var(--brand-500)] transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? t("bookings.creating", { defaultValue: "Creating..." }) : t("bookings.confirm")}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
