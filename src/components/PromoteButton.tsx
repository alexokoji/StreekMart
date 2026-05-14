"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  kind: "product" | "post";
  id: string;
  disabled?: boolean;
};

export function PromoteButton({ kind, id, disabled }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(7);
  const [open, setOpen] = useState(false);

  async function promote() {
    setBusy(true);
    try {
      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, days }),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (disabled) {
    return <button disabled className="btn-secondary opacity-60">Promoted</button>;
  }

  return (
    <div className="relative">
      <button type="button" className="btn-primary" onClick={() => setOpen((v) => !v)}>
        Promote
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-64 card p-4 shadow-lg">
          <p className="mb-2 text-sm font-medium">Boost visibility in the feed</p>
          <label className="label text-xs">Duration (days)</label>
          <input
            type="number"
            min={1}
            max={30}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="input"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className="btn-secondary text-xs" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="btn-primary text-xs" disabled={busy} onClick={promote}>
              {busy ? "Promoting…" : "Confirm"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
