"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Mounted on /account so any logged-in user can request a role change.
// Shows the user's current roles, lets them tick the target state,
// optionally write a reason, and POSTs. Pending requests render a
// read-only "awaiting review" state instead of the form.
export function RoleChangePanel({
  currentIsSeller,
  currentIsDesigner,
  pending,
}: {
  currentIsSeller: boolean;
  currentIsDesigner: boolean;
  pending: {
    id: string;
    toIsSeller: boolean;
    toIsDesigner: boolean;
    createdAt: string;
  } | null;
}) {
  const router = useRouter();
  const [toIsSeller, setToIsSeller] = useState(currentIsSeller);
  const [toIsDesigner, setToIsDesigner] = useState(currentIsDesigner);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (pending) {
    const requestedRoles = [
      pending.toIsSeller && "Seller",
      pending.toIsDesigner && "Designer",
      !pending.toIsSeller && !pending.toIsDesigner && "Buyer only",
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      <div className="card border-amber-200 bg-amber-50/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
          Role change · pending
        </p>
        <p className="mt-1 text-sm">
          You&rsquo;ve requested to be <strong>{requestedRoles}</strong>. An admin
          will review it; you&rsquo;ll get an email once a decision is made.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="card border-emerald-200 bg-emerald-50/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
          Submitted
        </p>
        <p className="mt-1 text-sm">
          Thanks — your request is in the admin queue. We&rsquo;ll email you on a
          decision.
        </p>
      </div>
    );
  }

  const noChange = toIsSeller === currentIsSeller && toIsDesigner === currentIsDesigner;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/account/role-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toIsSeller,
          toIsDesigner,
          reason: reason || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't submit.");
        return;
      }
      setSubmitted(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <div>
        <h2 className="font-display text-lg font-semibold">Change your role</h2>
        <p className="text-xs text-ink-500">
          Want to add a seller storefront or start a designer portfolio? Pick the
          roles you want and an admin will review your request.
        </p>
      </div>

      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-ink-200 p-3 hover:border-violet-300">
          <input
            type="checkbox"
            checked={toIsSeller}
            onChange={(e) => setToIsSeller(e.target.checked)}
            className="h-4 w-4"
          />
          <div>
            <p className="text-sm font-medium">Seller</p>
            <p className="text-xs text-ink-500">
              List products (fabrics, ready-to-wear, accessories) and access /seller.
            </p>
          </div>
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-ink-200 p-3 hover:border-violet-300">
          <input
            type="checkbox"
            checked={toIsDesigner}
            onChange={(e) => setToIsDesigner(e.target.checked)}
            className="h-4 w-4"
          />
          <div>
            <p className="text-sm font-medium">Designer</p>
            <p className="text-xs text-ink-500">
              Publish posts, build look-books, accept commissions, access /designer.
            </p>
          </div>
        </label>
      </div>

      <div>
        <label className="label">Why? (optional)</label>
        <textarea
          className="input min-h-[80px] text-sm"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
          placeholder="Helps the reviewer say yes faster."
        />
      </div>

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <button
        type="submit"
        className="btn-primary"
        disabled={busy || noChange}
      >
        {busy ? "Submitting…" : noChange ? "No change" : "Request role change"}
      </button>
    </form>
  );
}
