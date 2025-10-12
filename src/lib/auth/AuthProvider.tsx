import React, { createContext, useContext, useEffect, useState } from "react";
import { authClient, type User } from "./authClient";
import { supabase } from "../supabase";

type Ctx = {
  user: User;
  loading: boolean;
  login: (p:{email:string; password?:string})=>Promise<void>;
  register: (p:{email:string; password?:string})=>Promise<void>;
  logout: ()=>Promise<void>;
};

const AuthCtx = createContext<Ctx|undefined>(undefined);

export function AuthProvider({ children }:{ children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    setLoading(true);
    let u = await authClient.getSession();
    if (!u) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        u = { id: session.user.id, email: session.user.email || '' };
        localStorage.setItem('demo_user', JSON.stringify(u));
      }
    }
    setUser(u);
    setLoading(false);
  })(); }, []);

  const login = async (p:{email:string; password?:string})=>{
    const u = await authClient.signInEmail(p);
    setUser(u);
  };
  const register = async (p:{email:string; password?:string})=>{
    const u = await authClient.signUpEmail(p);
    setUser(u);
  };
  const logout = async ()=>{
    await authClient.signOut();
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = ()=>{
  const ctx = useContext(AuthCtx);
  if(!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
