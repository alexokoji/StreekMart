"use client";

import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/utils";
import { ImageUploader } from "@/components/forms/ImageUploader";
import { TierBadge } from "@/components/TierBadge";

type Req = {
  id: string;
  kind: "SELLER" | "DESIGNER";
  tier: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  idType: string | null;
  idNumber: string | null;
  businessName: string | null;
  storeImageUrl: string | null;
  cacDocumentUrl: string | null;
  notes: string | null;
  decisionNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

type IdType = "NIN" | "PASSPORT" | "DRIVERS_LICENSE";
const ID_TYPE_LABEL: Record<IdType, string> = {
  NIN: "National Identification Number (NIN)",
  PASSPORT: "International Passport",
  DRIVERS_LICENSE: "Driver's License",
};

// Two-card tier verification panel.
//
// Tier 2 (blue check) is identity verification — NIN, Passport, or Driver's
// License with the matching ID number. Required before a seller can list
// any products.
//
// Tier 3 (gold check) is business verification — CAC document upload with
// an optional storefront photo. Only available once Tier 2 is approved.
// Unlocks the higher product cap (100) and the reduced withdrawal fee.
export function VerificationPanel({
  kind,
  currentTier,
}: {
  kind: "SELLER" | "DESIGNER";
  currentTier: number;
}) {
  const [requests, setRequests] = useState<Req[] | null>(null);

  async function refresh() {
    const res = await fetch("/api/verifications");
    if (res.ok) {
      const data = await res.json();
      setRequests((data.requests as Req[]).filter((r) => r.kind === kind));
    }
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tier2Pending = requests?.find((r) => r.tier === 2 && r.status === "PENDING");
  const tier3Pending = requests?.find((r) => r.tier === 3 && r.status === "PENDING");

  return (
    <div className="space-y-5">
      {/* Current tier banner */}
      <div className="card flex items-center gap-3 p-4">
        <TierBadge tier={currentTier} variant="pill" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            You&apos;re currently at <span className="font-bold">Tier {currentTier}</span>
            {currentTier === 1 ? " — unverified" : currentTier === 2 ? " — verified" : " — gold verified"}.
          </p>
          <p className="text-xs text-ink-500">
            {currentTier === 1 &&
              "Verify your identity to unlock product listings, lower fees, and the verified badge."}
            {currentTier === 2 &&
              "You can list up to 30 products at 3% withdrawal fee. Upgrade to Tier 3 for the gold badge, 100 listings, and 1.5% fees."}
            {currentTier === 3 && "You're at the top tier — 100 listings, 1.5% withdrawal fee, gold badge."}
          </p>
        </div>
      </div>

      {/* Tier 2 card */}
      <Tier2Card
        kind={kind}
        currentTier={currentTier}
        pending={tier2Pending}
        onSubmitted={refresh}
      />

      {/* Tier 3 card */}
      <Tier3Card
        kind={kind}
        currentTier={currentTier}
        pending={tier3Pending}
        onSubmitted={refresh}
      />

      {/* History */}
      {requests && requests.length > 0 && (
        <section className="card overflow-hidden">
          <header className="border-b border-ink-100 p-4">
            <h3 className="font-display text-base font-semibold">History</h3>
          </header>
          <ul className="divide-y divide-ink-100">
            {requests.map((r) => (
              <li key={r.id} className="p-4 text-sm">
                <p className="font-medium">
                  Tier {r.tier} —{" "}
                  {r.status === "APPROVED" && <span className="text-emerald-accent">Approved</span>}
                  {r.status === "REJECTED" && <span className="text-burgundy-700">Rejected</span>}
                  {r.status === "PENDING" && <span className="text-amber-700">Pending</span>}
                  <span className="ml-2 text-xs text-ink-500">· {timeAgo(r.createdAt)}</span>
                </p>
                {r.decisionNote && (
                  <p className="mt-1 text-xs text-ink-500">Admin note: {r.decisionNote}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Tier2Card({
  kind,
  currentTier,
  pending,
  onSubmitted,
}: {
  kind: "SELLER" | "DESIGNER";
  currentTier: number;
  pending: Req | undefined;
  onSubmitted: () => void;
}) {
  const [idType, setIdType] = useState<IdType>("NIN");
  const [idNumber, setIdNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (currentTier >= 2) {
    return (
      <div className="card flex items-center gap-3 p-5">
        <span className="badge bg-sky-100 text-sky-700">Tier 2 ✓</span>
        <p className="text-sm text-ink-600">
          Identity verified. Your blue badge is live across StreekMart.
        </p>
      </div>
    );
  }

  if (pending) {
    return (
      <div className="card p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
          Tier 2 — pending review
        </p>
        <p className="mt-1 text-sm">
          Submitted {timeAgo(pending.createdAt)} with{" "}
          {pending.idType && ID_TYPE_LABEL[pending.idType as IdType]}.
          You&apos;ll be able to list products once approved.
        </p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, tier: 2, idType, idNumber, notes: notes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't submit.");
        return;
      }
      setIdNumber("");
      setNotes("");
      onSubmitted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <div>
        <div className="flex items-center gap-2">
          <span className="badge bg-sky-50 text-sky-700">Tier 2</span>
          <h3 className="font-display text-base font-semibold">Identity verification</h3>
        </div>
        <p className="mt-1 text-xs text-ink-500">
          Required before you can list products. Pick one government-issued ID
          and enter the matching number. Admins verify each submission manually.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="label">ID type</legend>
        {(["NIN", "PASSPORT", "DRIVERS_LICENSE"] as IdType[]).map((t) => (
          <label
            key={t}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
              idType === t ? "border-violet-500 bg-violet-50/40" : "border-ink-200"
            }`}
          >
            <input
              type="radio"
              className="mt-0.5"
              checked={idType === t}
              onChange={() => setIdType(t)}
            />
            <div>
              <p className="text-sm font-medium">{ID_TYPE_LABEL[t]}</p>
            </div>
          </label>
        ))}
      </fieldset>

      <div>
        <label className="label">ID number</label>
        <input
          className="input"
          required
          minLength={4}
          maxLength={50}
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value)}
          placeholder={
            idType === "NIN"
              ? "11-digit NIN"
              : idType === "PASSPORT"
              ? "e.g. A12345678"
              : "e.g. ABC12345AB"
          }
          autoComplete="off"
        />
      </div>

      <div>
        <label className="label">
          Anything else <span className="text-xs text-ink-400">(optional)</span>
        </label>
        <textarea
          className="input min-h-[60px] text-sm"
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything that helps the reviewer trust you faster."
        />
      </div>

      {err && <p className="text-sm text-burgundy-700">{err}</p>}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Submitting…" : "Submit Tier 2 verification"}
      </button>
    </form>
  );
}

function Tier3Card({
  kind,
  currentTier,
  pending,
  onSubmitted,
}: {
  kind: "SELLER" | "DESIGNER";
  currentTier: number;
  pending: Req | undefined;
  onSubmitted: () => void;
}) {
  const [cacDocumentUrl, setCacDocumentUrl] = useState("");
  const [storeImageUrl, setStoreImageUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (currentTier >= 3) {
    return (
      <div className="card flex items-center gap-3 p-5">
        <span className="badge bg-gold-100 text-gold-700">Tier 3 ★</span>
        <p className="text-sm text-ink-600">
          Gold verified. 100 listing cap and 1.5% withdrawal fee unlocked.
        </p>
      </div>
    );
  }

  if (currentTier < 2) {
    return (
      <div className="card border-dashed p-5 opacity-70">
        <div className="flex items-center gap-2">
          <span className="badge bg-gold-50 text-gold-700">Tier 3</span>
          <h3 className="font-display text-base font-semibold">Business verification</h3>
          <span className="badge bg-ink-50 text-ink-500">Locked</span>
        </div>
        <p className="mt-1 text-xs text-ink-500">
          Complete Tier 2 (identity verification) first. Tier 3 unlocks the 100
          listing cap and reduces your withdrawal fee from 3% to 1.5%.
        </p>
      </div>
    );
  }

  if (pending) {
    return (
      <div className="card p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
          Tier 3 — pending review
        </p>
        <p className="mt-1 text-sm">
          Submitted {timeAgo(pending.createdAt)}. You&apos;ll keep Tier 2 access in
          the meantime.
        </p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!cacDocumentUrl) {
      setErr("Upload your CAC certificate.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          tier: 3,
          cacDocumentUrl,
          storeImageUrl: storeImageUrl || undefined,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't submit.");
        return;
      }
      setCacDocumentUrl("");
      setStoreImageUrl("");
      setNotes("");
      onSubmitted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <div>
        <div className="flex items-center gap-2">
          <span className="badge bg-gold-50 text-gold-700">Tier 3</span>
          <h3 className="font-display text-base font-semibold">Business verification</h3>
        </div>
        <p className="mt-1 text-xs text-ink-500">
          Upload your CAC certificate to apply for the gold badge. A storefront
          photo is optional but speeds up review.
        </p>
      </div>

      <div>
        <label className="label">CAC certificate (required)</label>
        <ImageUploader
          value={cacDocumentUrl ? [cacDocumentUrl] : []}
          onChange={(arr) => setCacDocumentUrl(arr[0] ?? "")}
          multi={false}
          label="Clear image or PDF screenshot of the certificate."
        />
      </div>

      <div>
        <label className="label">
          Storefront photo <span className="text-xs text-ink-400">(optional)</span>
        </label>
        <ImageUploader
          value={storeImageUrl ? [storeImageUrl] : []}
          onChange={(arr) => setStoreImageUrl(arr[0] ?? "")}
          multi={false}
          label="Photo of your shop or workspace with signage visible."
        />
      </div>

      <div>
        <label className="label">
          Anything else <span className="text-xs text-ink-400">(optional)</span>
        </label>
        <textarea
          className="input min-h-[60px] text-sm"
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Social handles, press features, anything that builds trust."
        />
      </div>

      {err && <p className="text-sm text-burgundy-700">{err}</p>}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Submitting…" : "Submit Tier 3 verification"}
      </button>
    </form>
  );
}
