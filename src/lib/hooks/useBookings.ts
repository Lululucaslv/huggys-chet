import { useEffect, useState } from "react";
import { listUserBookings, type UserBooking } from "../api/bookings.user";

export function useBookings({
  user_id,
  therapist_code,
  tz
}: {
  user_id: string;
  therapist_code: string;
  tz: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<UserBooking[]>([]);

  async function refresh() {
    try {
      setLoading(true);
      setError(null);
      
      const res = await listUserBookings({ user_id, therapist_code, tz });
      
      if (!res.ok) throw new Error("Failed to load bookings");
      
      setItems(res.data);
    } catch (e: any) {
      setError(e?.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [user_id, therapist_code, tz]);

  function optimisticAdd(b: UserBooking) {
    setItems(x => [b, ...x]);
  }

  function optimisticRemove(id: string) {
    setItems(x => x.filter(i => i.id !== id));
  }

  function optimisticUpdate(id: string, patch: Partial<UserBooking>) {
    setItems(x => x.map(i => (i.id === id ? { ...i, ...patch } : i)));
  }

  return {
    loading,
    error,
    items,
    refresh,
    optimisticAdd,
    optimisticRemove,
    optimisticUpdate
  };
}
