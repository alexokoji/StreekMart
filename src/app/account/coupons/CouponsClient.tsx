"use client";

import { useState } from "react";

type Coupon = {
  id: string;
  code: string;
  kind: string;
  value: number;
  maxDiscountCents: number | null;
  minSubtotalCents: number | null;
  endsAt: string | null;
  description: string | null;
  claimedAt?: string;
};

function discountLabel(c: Coupon) {
  if (c.kind === "FLAT") return `NGN ${Math.round(c.value / 100).toLocaleString("en-NG")} off`;
  if (c.kind === "PERCENT") return `${(c.value / 100).toFixed(0)}% off${c.maxDiscountCents ? ` (up to NGN ${Math.round(c.maxDiscountCents / 100)})` : ""}`;
  return "Discount";
}

export function CouponsClient({
  initialAvailable,
  initialMine,
}: {
  initialAvailable: Coupon[];
  initialMine: Coupon[];
}) {
  const [available, setAvailable] = useState(initialAvailable);
  const [mine, setMine] = useState(initialMine);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function claim(c: Coupon) {
    setBusy(c.id);
    try {
      const res = await fetch(`/api/coupons/${encodeURIComponent(c.code)}/claim`, { method: "POST" });
      if (!res.ok) return;
      setAvailable((cur) => cur.filter((x) => x.id !== c.id));
      setMine((cur) => [{ ...c, claimedAt: new Date().toISOString() }, ...cur]);
    } finally {
      setBusy(null);
    }
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <h2 className="font-display text-lg font-semibold">Available to claim</h2>
        {available.length === 0 ? (
          <div className="card mt-3 p-6 text-center text-sm text-ink-500">
            Nothing to claim right now &mdash; check back soon.
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {available.map((c) => (
              <li key={c.id} className="card flex items-center justify-between p-4">
                <div className="min-w-0">
                  <p className="font-display text-base font-semibold">{discountLabel(c)}</p>
                  {c.description && <p className="text-xs text-ink-500">{c.description}</p>}
                  {c.endsAt && (
                    <p className="mt-1 text-xs text-ink-500">
                      Ends {new Date(c.endsAt).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => claim(c)}
                  disabled={busy === c.id}
                  className="btn-primary text-sm"
                >
                  {busy === c.id ? "..." : "Claim"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold">My coupons</h2>
        {mine.length === 0 ? (
          <div className="card mt-3 p-6 text-center text-sm text-ink-500">
            You haven&rsquo;t saved any coupons yet.
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {mine.map((c) => (
              <li key={c.id} className="card flex items-center justify-between p-4">
                <div className="min-w-0">
                  <p className="font-display text-base font-semibold">{discountLabel(c)}</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-violet-700">{c.code}</p>
                  {c.endsAt && (
                    <p className="text-xs text-ink-500">
                      Ends {new Date(c.endsAt).toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                  )}
                </div>
                <button onClick={() => copy(c.code)} className="btn-secondary text-sm">
                  {copied === c.code ? "Copied" : "Copy code"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}