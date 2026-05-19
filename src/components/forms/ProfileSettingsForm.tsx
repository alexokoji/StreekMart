"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUploader } from "@/components/forms/ImageUploader";
import { LocationPicker } from "@/components/forms/LocationPicker";

type Initial = {
  name: string;
  email: string;
  bio: string | null;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  slug: string | null;
  phone: string | null;
  // Locked once non-null — the form swaps to a read-only chip + change-request
  // panel in that case.
  businessName: string | null;
  isSeller: boolean;
  isDesigner: boolean;
  country: string | null;
  city: string | null;
  region: string | null;
  // Latest in-flight change request, if any. Drives the "pending review"
  // hint under the business-name chip so the user doesn't double-submit.
  pendingBusinessNameRequest:
    | { id: string; requestedName: string; createdAt: string }
    | null;
};

// Shared profile editor used by /account/settings, /seller/settings, and
// /designer/settings. Permissions are shown but read-only — see
// PATCH /api/account/profile for the rationale.
//
// Business-name policy: the field is editable on the FIRST save (legacy
// users with `businessName=null` can still fill it in). After that, the
// chip is locked and a separate "Request name change" form submits to
// /api/account/business-name-change for admin approval.
export function ProfileSettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [businessNameDraft, setBusinessNameDraft] = useState("");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(initial.coverImageUrl ?? "");
  const [slug, setSlug] = useState(initial.slug ?? "");
  // Cascading country → state → city. Single state object keeps the
  // LocationPicker's reset-downstream logic clean.
  const [location, setLocation] = useState({
    country: initial.country ?? "",
    region: initial.region ?? "",
    city: initial.city ?? "",
  });
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  // Change-request panel state — separate flow that POSTs to a different endpoint.
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeName, setChangeName] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [changeBusy, setChangeBusy] = useState(false);
  const [changeMsg, setChangeMsg] = useState<
    { kind: "ok" | "err"; text: string } | null
  >(null);

  const businessLocked = !!initial.businessName;
  const showBusinessFirstTime = initial.isSeller && !businessLocked;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const payload: Record<string, string> = { name, bio, avatarUrl, coverImageUrl };
      if (email !== initial.email) payload.email = email;
      if (slug && slug !== initial.slug) payload.slug = slug;
      if (password) payload.password = password;
      if (phone !== (initial.phone ?? "")) payload.phone = phone;
      // Only send the business name on the very first set. Subsequent edits
      // must go through the change-request flow; the API enforces this and
      // returns 403 if we send the field anyway.
      if (showBusinessFirstTime && businessNameDraft) {
        payload.businessName = businessNameDraft;
      }
      if (location.country && location.country !== initial.country) payload.country = location.country;
      if (location.city !== (initial.city ?? "")) payload.city = location.city;
      if (location.region !== (initial.region ?? "")) payload.region = location.region;

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

  async function submitChangeRequest(e: React.FormEvent) {
    e.preventDefault();
    setChangeBusy(true);
    setChangeMsg(null);
    try {
      const res = await fetch("/api/account/business-name-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedName: changeName, note: changeNote || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setChangeMsg({ kind: "err", text: data.error ?? "Couldn't submit the request." });
        return;
      }
      setChangeMsg({
        kind: "ok",
        text: "Submitted. An admin will review your change request shortly.",
      });
      setChangeName("");
      setChangeNote("");
      router.refresh();
    } finally {
      setChangeBusy(false);
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
        <label className="label">Phone number</label>
        <input
          type="tel"
          required
          inputMode="tel"
          className="input"
          placeholder="+234 803 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <p className="mt-1 text-[11px] text-ink-500">
          Used for delivery contact and order updates — kept private to buyers and sellers in your orders.
        </p>
      </div>

      {/* Business name. Three render modes:
            1. Seller with no business name yet — editable (first-time set).
            2. Seller (or non-seller) with a business name — locked + change-request panel.
            3. Non-seller without one — not shown.
       */}
      {showBusinessFirstTime && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
          <label className="label">
            Business name <span className="text-burgundy-700">*</span>
          </label>
          <input
            required
            minLength={2}
            maxLength={80}
            className="input"
            placeholder="e.g. Adaeze Tailoring"
            value={businessNameDraft}
            onChange={(e) => setBusinessNameDraft(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-ink-500">
            Shown to buyers on every product card and on your shop profile.{" "}
            <span className="font-semibold text-ink-700">
              Once saved you can&apos;t edit it directly — admins handle changes.
            </span>
          </p>
        </div>
      )}

      {businessLocked && (
        <div className="rounded-xl border border-ink-100 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-500">
            Business name
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 font-display text-sm font-semibold text-violet-800">
              {initial.businessName}
            </span>
            <span className="badge bg-ink-100 text-ink-600">Locked</span>
            {initial.pendingBusinessNameRequest && (
              <span className="badge bg-gold-50 text-gold-700">
                Pending: {initial.pendingBusinessNameRequest.requestedName}
              </span>
            )}
          </div>

          {initial.pendingBusinessNameRequest ? (
            <p className="mt-2 text-[11px] text-ink-500">
              Your change request is awaiting admin review. You&apos;ll see the new
              name here as soon as it&apos;s approved.
            </p>
          ) : (
            <div className="mt-3">
              <button
                type="button"
                className="text-xs font-semibold text-violet-700 hover:underline"
                onClick={() => setChangeOpen((v) => !v)}
              >
                {changeOpen ? "Cancel change request" : "Request name change →"}
              </button>
              {changeOpen && (
                <div className="mt-3 space-y-2 rounded-lg border border-ink-100 bg-ink-50/40 p-3">
                  <input
                    className="input text-sm"
                    placeholder="New business name"
                    value={changeName}
                    minLength={2}
                    maxLength={80}
                    onChange={(e) => setChangeName(e.target.value)}
                  />
                  <textarea
                    className="input min-h-[60px] text-sm"
                    placeholder="Reason for the change (optional, shown to admin)"
                    maxLength={400}
                    value={changeNote}
                    onChange={(e) => setChangeNote(e.target.value)}
                  />
                  {changeMsg && (
                    <p
                      className={`text-xs ${
                        changeMsg.kind === "ok"
                          ? "text-emerald-accent"
                          : "text-burgundy-700"
                      }`}
                    >
                      {changeMsg.text}
                    </p>
                  )}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={submitChangeRequest}
                      disabled={changeBusy || !changeName.trim()}
                      className="btn-primary text-xs"
                    >
                      {changeBusy ? "Submitting…" : "Submit for review"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
        <div className="mt-3">
          <LocationPicker value={location} onChange={setLocation} required={false} />
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
        <label className="label">Profile cover image</label>
        <ImageUploader
          value={coverImageUrl ? [coverImageUrl] : []}
          onChange={(arr) => setCoverImageUrl(arr[0] ?? "")}
          multi={false}
          label="Banner shown on your /u/ profile page. Wide landscape photos work best."
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
