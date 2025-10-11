import { useState } from "react";
import { useAuth } from "../../lib/auth/AuthProvider";

type Mode = "signin" | "signup";

export function AuthForm({ mode: defaultMode = "signup", onSuccess }:{
  mode?: Mode;
  onSuccess?: () => void;
}) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent){
    e.preventDefault();
    setErr("");
    if (!email) return setErr("Email is required.");
    if (!agree && mode === "signup") return setErr("Please agree to the terms.");
    try {
      setLoading(true);
      if (mode === "signin") await login({ email, password });
      else await register({ email, password });
      onSuccess?.();
    } catch (e:any) {
      setErr(e?.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-1">
        <label className="text-sm font-medium">Email</label>
        <input
          className="h-10 w-full rounded-[var(--radius-input)] border border-[var(--line)] bg-transparent
                     px-3 placeholder:text-[var(--muted)]
                     focus:border-[var(--brand-400)] focus:ring-2 focus:ring-[var(--brand-400)]/40"
          type="email" placeholder="you@example.com" value={email}
          onChange={(e)=> setEmail(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Password (optional)</label>
        <input
          className="h-10 w-full rounded-[var(--radius-input)] border border-[var(--line)] bg-transparent
                     px-3 placeholder:text-[var(--muted)]
                     focus:border-[var(--brand-400)] focus:ring-2 focus:ring-[var(--brand-400)]/40"
          type="password" placeholder="••••••••" value={password}
          onChange={(e)=> setPassword(e.target.value)}
        />
      </div>

      {mode === "signup" && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={agree} onChange={(e)=> setAgree(e.target.checked)} />
          I agree to the Terms and Privacy
        </label>
      )}

      {err && <p role="alert" className="text-sm text-[var(--danger-600)]">{err}</p>}

      <button
        type="submit"
        disabled={loading}
        className="h-11 w-full rounded-[var(--radius-input)] font-medium text-white
                   bg-[var(--brand-600)] hover:bg-[var(--brand-500)]
                   focus:outline-none focus:ring-2 focus:ring-[var(--brand-400)]
                   disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        {loading ? "Please wait…" : (mode === "signin" ? "Sign in" : "Sign up")}
      </button>

      <div className="text-sm text-center text-[var(--muted)]">
        {mode === "signin" ? (
          <>No account? <button type="button" className="underline" onClick={()=> setMode("signup")}>Create one</button></>
        ) : (
          <>Already have an account? <button type="button" className="underline" onClick={()=> setMode("signin")}>Sign in</button></>
        )}
      </div>

      <div className="text-xs text-[var(--muted)] text-center">
        This platform is not for emergencies. If you're in crisis, call your local hotline.
      </div>
    </form>
  );
}
