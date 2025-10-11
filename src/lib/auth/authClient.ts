export type User = { id: string; email: string } | null;

const KEY = "demo_user";

export const authClient = {
  async getSession(): Promise<User> {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  async signInEmail({ email }: { email: string; password?: string }) {
    const u = { id: "u_" + Math.random().toString(36).slice(2, 8), email };
    localStorage.setItem(KEY, JSON.stringify(u));
    return u;
  },
  async signUpEmail({ email }: { email: string; password?: string }) {
    const u = { id: "u_" + Math.random().toString(36).slice(2, 8), email };
    localStorage.setItem(KEY, JSON.stringify(u));
    return u;
  },
  async signOut() {
    localStorage.removeItem(KEY);
  },
};
