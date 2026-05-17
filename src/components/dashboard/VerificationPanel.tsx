"use client";

import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/utils";
import { ImageUploader } from "@/components/forms/ImageUploader";

type Req = {
  id: string;
  kind: "SELLER" | "DESIGNER";
  status: "PENDING" | "APPROVED" | "REJECTED";
  businessName: string | null;
  businessAddress: string | null;
  hasPhysicalStore: boolean;
  storeImageUrl: string | null;
  cacDocumentUrl: string | null;
  notes: string | null;
  decisionNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

// Verification request panel. Drives the form that proves a seller has a
// physical store (photo) or a registered online business (CAC certificate).
// Until approved, the user can't list products — see /api/products.
export function VerificationPanel({
  kind,
  alreadyVerified,
}: {
  kind: "SELLER" | "DESIGNER";
  alreadyVerified: boolean;
}) {
  const [requests, setRequests] = useState<Req[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Form state.
  const [businessName, setBusinessName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [hasPhysicalStore, setHasPhysicalStore] = useState(true);
  const [storeImageUrl, setStoreImageUrl] = useState("");
  const [cacDocumentUrl, setCacDocumentUrl] = useState("");
  const [notes, setNotes] = useState("");

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

  const pending = requests?.find((r) => r.status === "PENDING");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          businessName,
          businessAddress,
          hasPhysicalStore,
          storeImageUrl: storeImageUrl || undefined,
          cacDocumentUrl: cacDocumentUrl || undefined,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't submit.");
        return;
      }
      setBusinessName("");
      setBusinessAddress("");
      setStoreImageUrl("");
      setCacDocumentUrl("");
      setNotes("");
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {alreadyVerified ? (
        <div className="card flex items-center gap-3 p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-accent text-lg text-white">✓</span>
          <div>
            <p className="font-display text-base font-semibold">You&apos;re verified.</p>
            <p className="text-xs text-ink-500">A check mark shows next to your name across StreekMart and your listings are eligible for recommendations.</p>
          </div>
        </div>
      ) : pending ? (
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
            Pending review
          </p>
          <p className="mt-1 text-sm">
            Submitted {timeAgo(pending.createdAt)}. You&apos;ll be able to list products
            once an admin approves this request.
          </p>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-ink-500">Business name</dt>
              <dd className="font-medium">{pending.businessName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Type</dt>
              <dd className="font-medium">
                {pending.hasPhysicalStore ? "Physical store" : "Online-only"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-ink-500">Address</dt>
              <dd className="font-medium whitespace-pre-wrap">{pending.businessAddress ?? "—"}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <form onSubmit={submit} className="card space-y-4 p-5">
          <div>
            <h3 className="font-display text-base font-semibold">Request the verified badge</h3>
            <p className="mt-1 text-xs text-ink-500">
              Required before you can list products. Admins review every submission
              manually — accurate, current evidence speeds approval.
            </p>
          </div>

          <div>
            <label className="label">Business name</label>
            <input
              className="input"
              required
              minLength={2}
              maxLength={120}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Seoul Threads Ltd."
            />
          </div>

          <div>
            <label className="label">Business address</label>
            <textarea
              className="input min-h-[80px]"
              required
              minLength={5}
              maxLength={500}
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              placeholder="Street, area, city, state, country"
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="label">Business type</legend>
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
              hasPhysicalStore ? "border-violet-500 bg-violet-50/40" : "border-ink-200"
            }`}>
              <input
                type="radio"
                className="mt-0.5"
                checked={hasPhysicalStore}
                onChange={() => setHasPhysicalStore(true)}
              />
              <div>
                <p className="text-sm font-medium">I have a physical store</p>
                <p className="text-xs text-ink-500">Upload a photo of the storefront with the business name visible. CAC document is optional.</p>
              </div>
            </label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
              !hasPhysicalStore ? "border-violet-500 bg-violet-50/40" : "border-ink-200"
            }`}>
              <input
                type="radio"
                className="mt-0.5"
                checked={!hasPhysicalStore}
                onChange={() => setHasPhysicalStore(false)}
              />
              <div>
                <p className="text-sm font-medium">Online-only business</p>
                <p className="text-xs text-ink-500">CAC certificate (or equivalent business registration) is required.</p>
              </div>
            </label>
          </fieldset>

          {hasPhysicalStore && (
            <div>
              <label className="label">Storefront photo (required)</label>
              <ImageUploader
                value={storeImageUrl ? [storeImageUrl] : []}
                onChange={(arr) => setStoreImageUrl(arr[0] ?? "")}
                multi={false}
                label="Photo should clearly show your business signage."
              />
            </div>
          )}

          <div>
            <label className="label">
              CAC certificate{hasPhysicalStore ? <span className="text-xs text-ink-400"> (optional)</span> : " (required)"}
            </label>
            <ImageUploader
              value={cacDocumentUrl ? [cacDocumentUrl] : []}
              onChange={(arr) => setCacDocumentUrl(arr[0] ?? "")}
              multi={false}
              label="Upload a clear image or PDF screenshot of the certificate."
            />
          </div>

          <div>
            <label className="label">Anything else <span className="text-xs text-ink-400">(optional)</span></label>
            <textarea
              className="input min-h-[80px] text-sm"
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Social handles, press features, anything that helps a reviewer trust you faster."
            />
          </div>

          {err && <p className="text-sm text-burgundy-700">{err}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Submitting…" : "Submit verification"}
          </button>
        </form>
      )}

      {/* Past decisions */}
      {requests && requests.length > 0 && (
        <section className="card overflow-hidden">
          <header className="border-b border-ink-100 p-4">
            <h3 className="font-display text-base font-semibold">History</h3>
          </header>
          <ul className="divide-y divide-ink-100">
            {requests.map((r) => (
              <li key={r.id} className="p-4 text-sm">
                <p className="font-medium">
                  {r.status === "APPROVED" && <span className="text-emerald-accent">Approved</span>}
                  {r.status === "REJECTED" && <span className="text-burgundy-700">Rejected</span>}
                  {r.status === "PENDING" && <span className="text-amber-700">Pending</span>}
                  <span className="ml-2 text-xs text-ink-500">· {timeAgo(r.createdAt)}</span>
                </p>
                {r.businessName && <p className="mt-1 text-xs text-ink-600">{r.businessName}</p>}
                {r.decisionNote && <p className="mt-1 text-xs text-ink-500">Admin note: {r.decisionNote}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
