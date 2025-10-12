import { useEffect, useState } from "react";
import { listAvailability, type AvailabilitySlot } from "../api/bookings.user";
import { startOfDay, endOfDay, format } from "date-fns";

export function useSlots({
  therapist_code,
  date,
  tz
}: {
  therapist_code: string;
  date: Date;
  tz: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        
        const date_from = `${format(startOfDay(date), "yyyy-MM-dd")} 00:00`;
        const date_to = `${format(endOfDay(date), "yyyy-MM-dd")} 23:59`;
        
        const res = await listAvailability({
          therapist_code,
          tz,
          date_from,
          date_to,
          limit: 100,
          lang: "en"
        });
        
        if (!res.ok) throw new Error("Failed to load slots");
        
        setSlots(res.data);
      } catch (e: any) {
        setError(e?.message || "Failed to load slots");
      } finally {
        setLoading(false);
      }
    })();
  }, [therapist_code, tz, date]);

  return { loading, error, slots };
}
