import { create } from "zustand";
import { useAuth } from "./auth/AuthProvider";

export type Intent =
  | { type: "BOOK_CREATE"; payload?: { onAllow?: () => void; [key: string]: any } }
  | { type: "BOOK_RESCHEDULE"; payload?: { onAllow?: () => void; [key: string]: any } }
  | { type: "BOOK_CANCEL"; payload?: { onAllow?: () => void; [key: string]: any } }
  | { type: "ASSESSMENT_START"; payload?: { kind?: "phq9" | "gad7"; onAllow?: () => void; [key: string]: any } }
  | { type: "CHAT_CONTINUE"; payload?: { onAllow?: () => void; [key: string]: any } };

type GateState = {
  drawerOpen: boolean;
  intent: Intent | null;
  setOpen: (v:boolean)=>void;
  setIntent: (i:Intent|null)=>void;
};

export const useGateStore = create<GateState>((set)=>({
  drawerOpen: false,
  intent: null,
  setOpen: (v)=> set({ drawerOpen: v }),
  setIntent: (i)=> set({ intent: i }),
}));

export function useAuthGate(){
  const { user } = useAuth();
  const { setOpen, setIntent } = useGateStore();

  function requireAuth(intent: Intent){
    if (user) return { allowed: true };
    setIntent(intent);
    setOpen(true);
    return { allowed: false };
  }

  return { requireAuth };
}
