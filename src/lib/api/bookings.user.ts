import { track } from "../analytics";
import { AppConfig } from "../config";

export type AvailabilitySlot = {
  availabilityId: string;
  therapistCode: string;
  startUTC: string;
  endUTC: string;
  timeZone: string;
  display?: string;
};

export type UserBooking = {
  id: string;
  therapist: string;
  therapistCode: string;
  startUTC: string;
  endUTC: string;
  status: "confirmed" | "rescheduled" | "canceled";
  createdAt: string;
};

const MOCK = AppConfig.MOCK;
function idempotencyKey() {
  return "idem_" + Math.random().toString(36).slice(2) + Date.now();
}


export async function listAvailability(params: {
  therapist_code: string;
  tz: string;
  date_from: string;
  date_to: string;
  limit?: number;
  lang?: string;
}): Promise<{ ok: boolean; data: AvailabilitySlot[] }> {
  const startTime = Date.now();
  
  try {
    if (MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const mockSlots: AvailabilitySlot[] = [];
      const baseDate = new Date(params.date_from);
      
      for (let i = 0; i < 8; i++) {
        const slotDate = new Date(baseDate);
        slotDate.setHours(9 + i, 0, 0, 0);
        
        mockSlots.push({
          availabilityId: `slot_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
          therapistCode: params.therapist_code,
          startUTC: slotDate.toISOString(),
          endUTC: new Date(slotDate.getTime() + 60 * 60 * 1000).toISOString(),
          timeZone: params.tz,
          display: slotDate.toLocaleString("en-US", {
            month: "short",
            day: "2-digit",
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: params.tz
          })
        });
      }
      
      const elapsed = Date.now() - startTime;
      track("slot_list_fetch", { 
        date: params.date_from, 
        count: mockSlots.length, 
        ms: elapsed,
        tz: params.tz,
        therapist_code: params.therapist_code
      });
      
      return { ok: true, data: mockSlots };
    }
    
    const response = await fetch("/api/availability/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    const elapsed = Date.now() - startTime;
    track("slot_list_fetch", { 
      date: params.date_from, 
      count: result.data?.length || 0, 
      ms: elapsed,
      tz: params.tz,
      therapist_code: params.therapist_code
    });
    
    return result;
  } catch (error) {
    track("api_error_availability_list", { status: error instanceof Error ? error.message : "unknown" });
    throw error;
  }
}

export async function createBooking(params: {
  user_id: string;
  therapist_code: string;
  availability_id: string;
  tz: string;
  lang?: string;
  source?: string;
}): Promise<{ ok: boolean; data?: UserBooking; error?: string; status?: number }> {
  track("booking_create_attempt", { 
    availability_id: params.availability_id, 
    tz: params.tz,
    therapist_code: params.therapist_code,
    source: params.source || "unknown"
  });
  
  try {
    if (MOCK) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (Math.random() < 0.1) {
        track("booking_create_fail", { 
          status: 409, 
          err: "conflict",
          availability_id: params.availability_id,
          therapist_code: params.therapist_code
        });
        return { ok: false, error: "Slot was just taken", status: 409 };
      }
      
      const mockBooking: UserBooking = {
        id: `booking_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        therapist: "Dr. Smith",
        therapistCode: params.therapist_code,
        startUTC: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        endUTC: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
        status: "confirmed",
        createdAt: new Date().toISOString()
      };
      
      const stored = JSON.parse(localStorage.getItem("huggys_bookings") || "[]");
      stored.push(mockBooking);
      localStorage.setItem("huggys_bookings", JSON.stringify(stored));
      
      track("booking_create_success", { 
        booking_id: mockBooking.id,
        therapist_code: params.therapist_code,
        tz: params.tz
      });
      return { ok: true, data: mockBooking };
    }
    
    const response = await fetch("/api/bookings/create", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey()
      },
      body: JSON.stringify(params)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      track("booking_create_fail", { 
        status: response.status, 
        err: result.error,
        therapist_code: params.therapist_code
      });
      return { ok: false, error: result.error, status: response.status };
    }
    
    track("booking_create_success", { 
      booking_id: result.data?.id,
      therapist_code: params.therapist_code,
      tz: params.tz
    });
    return result;
  } catch (error) {
    track("api_error_bookings_create", { status: error instanceof Error ? error.message : "unknown" });
    throw error;
  }
}

export async function rescheduleBooking(params: {
  booking_id: string;
  user_id: string;
  therapist_code: string;
  new_availability_id: string;
  tz: string;
  lang?: string;
}): Promise<{ ok: boolean; data?: UserBooking; error?: string; status?: number }> {
  track("booking_reschedule_attempt", { 
    booking_id: params.booking_id,
    new_availability_id: params.new_availability_id,
    tz: params.tz,
    therapist_code: params.therapist_code
  });
  
  try {
    if (MOCK) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (Math.random() < 0.1) {
        track("booking_reschedule_fail", { 
          status: 409, 
          err: "conflict",
          booking_id: params.booking_id,
          new_availability_id: params.new_availability_id,
          therapist_code: params.therapist_code
        });
        return { ok: false, error: "New slot was just taken", status: 409 };
      }
      
      const stored = JSON.parse(localStorage.getItem("huggys_bookings") || "[]");
      const bookingIndex = stored.findIndex((b: UserBooking) => b.id === params.booking_id);
      
      if (bookingIndex >= 0) {
        stored[bookingIndex].startUTC = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
        stored[bookingIndex].endUTC = new Date(Date.now() + 49 * 60 * 60 * 1000).toISOString();
        stored[bookingIndex].status = "rescheduled";
        localStorage.setItem("huggys_bookings", JSON.stringify(stored));
        
        track("booking_reschedule_success", { 
          booking_id: params.booking_id,
          new_availability_id: params.new_availability_id,
          tz: params.tz
        });
        return { ok: true, data: stored[bookingIndex] };
      }
      
      track("booking_reschedule_fail", { 
        status: 404, 
        err: "not found",
        booking_id: params.booking_id
      });
      return { ok: false, error: "Booking not found", status: 404 };
    }
    
    const response = await fetch("/api/bookings/reschedule", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey()
      },
      body: JSON.stringify(params)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      track("booking_reschedule_fail", { 
        status: response.status, 
        err: result.error,
        booking_id: params.booking_id,
        therapist_code: params.therapist_code
      });
      return { ok: false, error: result.error, status: response.status };
    }
    
    track("booking_reschedule_success", { 
      booking_id: params.booking_id,
      new_availability_id: params.new_availability_id,
      tz: params.tz
    });
    return result;
  } catch (error) {
    track("api_error_bookings_reschedule", { status: error instanceof Error ? error.message : "unknown" });
    throw error;
  }
}

export async function cancelBooking(params: {
  booking_id: string;
  user_id: string;
  therapist_code: string;
  tz: string;
  lang?: string;
}): Promise<{ ok: boolean; error?: string }> {
  track("booking_cancel_attempt", { 
    booking_id: params.booking_id,
    therapist_code: params.therapist_code,
    tz: params.tz
  });
  
  try {
    if (MOCK) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const stored = JSON.parse(localStorage.getItem("huggys_bookings") || "[]");
      const filtered = stored.filter((b: UserBooking) => b.id !== params.booking_id);
      localStorage.setItem("huggys_bookings", JSON.stringify(filtered));
      
      track("booking_cancel_success", { 
        booking_id: params.booking_id,
        therapist_code: params.therapist_code
      });
      return { ok: true };
    }
    
    const response = await fetch("/api/bookings/cancel", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey()
      },
      body: JSON.stringify(params)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      track("booking_cancel_fail", { 
        status: response.status, 
        err: result.error,
        booking_id: params.booking_id,
        therapist_code: params.therapist_code
      });
      return { ok: false, error: result.error };
    }
    
    track("booking_cancel_success", { 
      booking_id: params.booking_id,
      therapist_code: params.therapist_code
    });
    return result;
  } catch (error) {
    track("api_error_bookings_cancel", { status: error instanceof Error ? error.message : "unknown" });
    throw error;
  }
}

export async function listUserBookings(params: {
  user_id: string;
  therapist_code: string;
  tz: string;
}): Promise<{ ok: boolean; data: UserBooking[] }> {
  try {
    if (MOCK) {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const stored = JSON.parse(localStorage.getItem("huggys_bookings") || "[]");
      return { ok: true, data: stored };
    }
    
    const response = await fetch("/api/bookings/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    track("api_error_bookings_list", { status: error instanceof Error ? error.message : "unknown" });
    throw error;
  }
}
