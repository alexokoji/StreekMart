"use client";

import { useState } from "react";

type Row = { userId: string; name: string; email: string; openOrders: number; currentHeldCents: number; correctHeldCents: number; differenceCents: number };

const naira = (c: number) => `₦${(c / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Admin tool: checks every seller's held (escrow) balance against the orders
// actually in flight, shows any that are out of line, and can correct them.
export function HeldFundsRepair() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function run(apply: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/repair-held", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply }),
      });
      const d = await res.json();
      if (res.ok) {
        setRows(d.rows);
        setDone(apply);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-3 p-5">
      <div>
        <h2 className="font-display text-lg font-semibold">Held funds check</h2>
        <p className="text-sm text-ink-600">
          Compares each seller&rsquo;s held (escrow) balance with the orders still waiting on delivery,
          and can correct any that are out of line.
        </p>
      </div>
      <div className="flex gap-2">
        <button className="btn-secondary text-sm" disabled={busy} onClick={() => run(false)}>
          {busy ? "Checking…" : "Check"}
        </button>
        {rows && rows.length > 0 && !done && (
          <button className="btn-primary text-sm" disabled={busy} onClick={() => run(true)}>
            Fix {rows.length} wallet{rows.length === 1 ? "" : "s"}
          </button>
        )}
      </div>
      {rows && rows.length === 0 && <p className="text-sm text-emerald-700">All held balances are correct.</p>}
      {rows && rows.length > 0 && (
        <>
          {done && <p className="text-sm text-emerald-700">Corrected. These wallets now match their open orders.</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-ink-500">
                <tr><th className="py-1 pr-3">Seller</th><th className="pr-3">Open orders</th><th className="pr-3">Held now</th><th className="pr-3">Should be</th><th>Difference</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.userId} className="border-t border-ink-100">
                    <td className="py-1.5 pr-3">{r.name}<span className="block text-xs text-ink-500">{r.email}</span></td>
                    <td className="pr-3">{r.openOrders}</td>
                    <td className="pr-3">{naira(r.currentHeldCents)}</td>
                    <td className="pr-3">{naira(r.correctHeldCents)}</td>
                    <td className={r.differenceCents < 0 ? "text-burgundy-700" : "text-emerald-700"}>{naira(r.differenceCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
