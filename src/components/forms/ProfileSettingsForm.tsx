"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUploader } from "@/components/forms/ImageUploader";
import { COUNTRIES } from "@/lib/location";

type Initial = {
  name: string;
  email: string;
  bio: string | null;
  avatarUrl: string | null;
  slug: string | null;
  isSeller: boolean;
  isDesigner: boolean;
  country: string | null;
  city: string | null;
  region: string | null;
};

// Shared profile editor used by both /seller/settings and /designer/settings.
// Permissions are shown but read-only — see PATCH /api/account/profile for
// the rationale.
export function ProfileSettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl ?? "");
  const [slug, setSlug] = useState(initial.slug ?? "");
  const [country, setCountry] = useState(initial.country ?? "");
  const [city, setCity] = useState(initial.city ?? "");
  const [region, setRegion] = useState(initial.region ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const payload: Record<string, string> = { name, bio, avatarUrl };
      if (email !== initial.email) payload.email = email;
      if (slug && slug !== initial.slug) payload.slug = slug;
      if (password) payload.password = password;
      if (country && country !== initial.country) payload.country = country;
      if (city !== (initial.city ?? "")) payload.city = city;
      if (region !== (initial.region ?? "")) payload.region = region;

      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: "err", text: data.error ?? "Couldn't save changes." });
        return;
      }
      setMsg({ kind: "ok", text: "Saved." });
      setPassword("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Display name</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label">Profile handle</label>
        <div className="flex items-center gap-1 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm focus-within:border-violet-500 focus-within:ring-4 focus-within:ring-violet-200/60">
          <span className="text-ink-400">/u/</span>
          <input
            className="flex-1 bg-transparent outline-none"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
            minLength={3}
            maxLength={30}
            placeholder="your-handle"
          />
        </div>
        <p className="mt-1 text-[11px] text-ink-500">
          This is your shareable URL. Lowercase letters, numbers, and dashes only.
        </p>
      </div>

      <div>
        <label className="label">Bio</label>
        <textarea
          className="input min-h-[100px]"
          value={bio}
          maxLength={500}
          onChange={(e) => setBio(e.target.value)}
          placeholder="A line or two about your label or aesthetic."
        />
        <p className="mt-1 text-[11px] text-ink-500">{bio.length}/500</p>
      </div>

      <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-500">
          Location
        </p>
        <p className="mt-1 text-[11px] text-ink-500">
          Drives delivery zones at checkout — buyers see fees specific to your
          city and country.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Country</label>
            <select
              className="input"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="">Select…</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">City</label>
            <input
              className="input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={80}
              placeholder="e.g. Lagos"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">
              State / Region <span className="text-xs text-ink-400">(optional)</span>
            </label>
            <input
              className="input"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              maxLength={80}
            />
          </div>
        </div>
      </div>

      <div>
        <label className="label">Avatar</label>
        <ImageUploader
          value={avatarUrl ? [avatarUrl] : []}
          onChange={(arr) => setAvatarUrl(arr[0] ?? "")}
          multi={false}
          label="Square photos look best. Paste a URL or upload from your device."
        />
      </div>

      <div>
        <label className="label">New password</label>
        <input
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Leave blank to keep current"
          minLength={8}
        />
      </div>

      <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-500">Permissions</p>
        <p className="mt-1 text-[11px] text-ink-500">
          Permissions are immutable once set at signup.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge enabled label="Buyer" />
          <Badge enabled={initial.isSeller} label="Seller" />
          <Badge enabled={initial.isDesigner} label="Designer" />
        </div>
      </div>

      {msg && (
        <p
          className={`text-sm ${
            msg.kind === "ok" ? "text-emerald-accent" : "text-burgundy-700"
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function Badge({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span
      className={`badge ${
        enabled ? "bg-violet-50 text-violet-700" : "bg-ink-100 text-ink-400"
      }`}
    >
      {label}
    </span>
  );
}
