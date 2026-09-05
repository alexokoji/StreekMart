"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export function LoginForm({
  redirectTo,
  oauthError,
}: {
  redirectTo?: string;
  oauthError?: string;
}) {
  // Google button is always rendered. If GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
  // aren't set, /api/auth/google/start returns an error and the page surfaces
  // it via ?error= â€” better than silently hiding the button (the previous
  // behaviour confused dev setup).
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(oauthError ?? null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Login failed");
        return;
      }
      router.replace(redirectTo || "/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <GoogleSignInButton intent="login" redirect={redirectTo} />
      <Divider>or sign in with email</Divider>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="text-right">
          <Link href="/forgot-password" className="text-xs text-brand-700 hover:underline">Forgot your password?</Link>
        </div>
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-600">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-brand-700 hover:underline">Create one</Link>
      </p>
    </div>
  );
}

function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex items-center">
      <div className="flex-1 border-t border-ink-200" />
      <span className="px-3 text-[11px] uppercase tracking-widest text-ink-500">{children}</span>
      <div className="flex-1 border-t border-ink-200" />
    </div>
  );
}
