import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabase";

export type User = { id: string; email?: string } | null;

type Ctx = {
  user: User;
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>({ user: null, loading: true, logout: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ? { id: session.user.id, email: session.user.email || undefined } : null);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email || undefined } : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
  }

  return <AuthCtx.Provider value={{ user, loading, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
