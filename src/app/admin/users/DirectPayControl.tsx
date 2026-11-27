"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Admin control for the direct-pay privilege on one seller. Shows whether the
// seller has added bank details yet, and lets the admin switch the privilege
// on/off and set this seller's platform cut.
export function DirectPayControl({
  userId,
  enabled,
  feeBps,
  hasBank,
}: {
  userId: string;
  enabled: boolean;
  feeBps: number | null;
  hasBank: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fee, setFee] = useState(feeBps == null ? "" : String(feeBps / 100));

  async function save(nextEnabled: boolean) {
    setErr(null);
    const pct = fee.trim() === "" ? null : Number(fee);
    if (pct !== null && (!Number.isFinite(pct) || pct < 0 || pct > 50)) {
      setErr("Fee must be between 0 and 50 %.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/direct-pay`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled, feeBps: pct === null ? null : Math.round(pct * 100) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setErr(d.error ?? "Couldn't save.");
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex w-full flex-wrap items-center gap-2 rounded-lg bg-ink-50 px-3 py-2 text-xs">
      <span className="font-semibold text-ink-700">Direct payments</span>
      <span className={enabled ? "badge bg-emerald-50 text-emerald-700" : "badge bg-ink-100 text-ink-600"}>
        {enabled ? (hasBank ? "On · bank added" : "On · waiting for bank details") : "Off"}
      </span>
      <label className="ml-auto flex items-center gap-1 text-ink-600">
        Platform cut
        <input
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          inputMode="decimal"
          placeholder="default"
          className="input w-20 py-1 text-xs"
          aria-label="Platform cut percent for this seller"
        />
        %
      </label>
      {enabled ? (
        <>
          <button className="btn-secondary px-3 py-1 text-xs" disabled={busy} onClick={() => save(true)}>
            Save
          </button>
          <button className="btn-secondary px-3 py-1 text-xs text-burgundy-700" disabled={busy} onClick={() => save(false)}>
            Turn off
          </button>
        </>
      ) : (
        <button className="btn-primary px-3 py-1 text-xs" disabled={busy} onClick={() => save(true)}>
          Enable
        </button>
      )}
      {err && <span className="w-full text-burgundy-700">{err}</span>}
    </div>
  );
}
