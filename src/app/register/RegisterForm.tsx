"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { LocationPicker } from "@/components/forms/LocationPicker";
import { CATEGORY_GROUPS } from "@/lib/enums";

const INTEREST_OPTIONS = Object.values(CATEGORY_GROUPS).flat();

type Gender = "female" | "male" | "nonbinary" | "prefer-not-to-say";

export function RegisterForm() {
  // Google button always renders. If GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
  // aren't configured, the start endpoint surfaces an error — we don't hide
  // the button silently because that confused dev setup before.
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Cascading country → state → city — single state object so updates
  // stay atomic and the picker can reset downstream fields cleanly.
  const [location, setLocation] = useState({ country: "", region: "", city: "" });
  const [gender, setGender] = useState<Gender | "">("");
  const [interests, setInterests] = useState<string[]>([]);
  const [isSeller, setIsSeller] = useState(false);
  const [isDesigner, setIsDesigner] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleInterest(c: string) {
    setInterests((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          country: location.country,
          city: location.city,
          region: location.region || undefined,
          gender: gender || undefined,
          interests: interests.length > 0 ? interests : undefined,
          isSeller,
          isDesigner,
        }),
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

        <LocationPicker value={location} onChange={setLocation} />

        <div className="rounded-xl border border-ink-100 bg-violet-50/30 p-3">
          <p className="label">Tell us what you love <span className="text-xs text-ink-400">(optional)</span></p>
          <p className="-mt-0.5 text-xs text-ink-500">
            We use this to curate the homepage and search suggestions for you. You can
            change it later from Account settings.
          </p>

          <div className="mt-3">
            <label className="label">Shopping for</label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["female", "Womenswear"],
                  ["male", "Menswear"],
                  ["nonbinary", "Unisex"],
                  ["prefer-not-to-say", "Skip"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setGender(v)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    gender === v
                      ? "border-violet-500 bg-violet-100 text-violet-700"
                      : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <label className="label">Interests</label>
            <div className="flex flex-wrap gap-1.5">
              {INTEREST_OPTIONS.map((c) => {
                const on = interests.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleInterest(c)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                      on
                        ? "border-violet-500 bg-violet-100 text-violet-700"
                        : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-ink-500">
              {interests.length === 0 ? "Pick any that fit" : `${interests.length} selected`}
            </p>
          </div>
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
