"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export function RegisterForm() {
  // Google button always renders. If GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
  // aren't configured, the start endpoint surfaces an error — we don't hide
  // the button silently because that confused dev setup before.
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSeller, setIsSeller] = useState(false);
  const [isDesigner, setIsDesigner] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, isSeller, isDesigner }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Registration failed");
        return;
      }
      router.replace("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div>
        <label className="label">Account type</label>
        <p className="mb-3 text-xs text-gray-500">
          Every account can shop StreekMart. Pick any extras you want enabled — these are permanent and cannot be changed later.
        </p>
        <div className="space-y-2">
          <PermCheck label="Buyer" desc="Browse, save, and shop." enabled disabled />
          <PermCheck
            label="Seller"
            desc="List products and materials for sale."
            enabled={isSeller}
            onChange={setIsSeller}
          />
          <PermCheck
            label="Designer"
            desc="Publish posts and use the Sketch Studio."
            enabled={isDesigner}
            onChange={setIsDesigner}
          />
        </div>
      </div>

      <GoogleSignInButton
        intent="signup"
        isSeller={isSeller}
        isDesigner={isDesigner}
        label="Continue with Google"
      />
      <p className="-mt-1 text-center text-[11px] text-ink-500">
        Your role choice above is carried into the Google sign-up.
      </p>
      <Divider>or with email</Divider>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" required className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" required minLength={8} className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="mt-1 text-xs text-gray-500">At least 8 characters.</p>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-700 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}

function PermCheck({
  label,
  desc,
  enabled,
  disabled,
  onChange,
}: {
  label: string;
  desc: string;
  enabled: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
        enabled ? "border-amber-500 bg-amber-50/40" : "border-gray-300"
      } ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4"
        checked={enabled}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
    </label>
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
