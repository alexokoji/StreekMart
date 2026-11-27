"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BANKS } from "@/lib/banks";

// Seller's direct-pay setup, shown only once an admin has enabled the
// privilege. Bank details here are where each paid order is sent.
export function DirectPayCard({
  initial,
}: {
  initial: { bankCode: string; accountNumber: string; accountName: string; deliveryFeeNaira: number; active: boolean };
}) {
  const router = useRouter();
  const [bankCode, setBankCode] = useState(initial.bankCode);
  const [accountNumber, setAccountNumber] = useState(initial.accountNumber);
  const [accountName, setAccountName] = useState(initial.accountName);
  const [fee, setFee] = useState(String(initial.deliveryFeeNaira || 0));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/seller/direct-pay", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankCode, accountNumber, accountName, deliveryFeeNaira: Number(fee) || 0 }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ ok: false, text: d.error ?? "Couldn't save." });
      else {
        setMsg({ ok: true, text: "Saved. New orders now pay straight to this account." });
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="card space-y-4 p-6">
      <div>
        <h2 className="font-display text-lg font-semibold">Direct payments</h2>
        <p className="mt-1 text-sm text-ink-600">
          Enabled for your shop by StreekMart. Your products skip our delivery partners: you deliver
          yourself and charge the delivery fee below. When a customer pays, the money is sent straight
          to your bank account instead of being held until delivery.
        </p>
        {!initial.active && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Add your bank details to switch this on. Until then your orders use normal delivery and payouts.
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="dp-bank">Bank</label>
          <select id="dp-bank" className="input" value={bankCode} onChange={(e) => setBankCode(e.target.value)} required>
            <option value="">Choose your bank</option>
            {BANKS.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="dp-acct">Account number</label>
          <input id="dp-acct" className="input" inputMode="numeric" maxLength={10} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))} required />
        </div>
        <div>
          <label className="label" htmlFor="dp-name">Account name</label>
          <input id="dp-name" className="input" value={accountName} onChange={(e) => setAccountName(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="dp-fee">Delivery fee you charge (₦)</label>
          <input id="dp-fee" className="input" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
          <p className="mt-1 text-[11px] text-ink-500">Flat, once per order. Enter 0 for free delivery.</p>
        </div>
      </div>
      {msg && <p className={msg.ok ? "text-sm text-emerald-700" : "text-sm text-burgundy-700"}>{msg.text}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save bank details"}</button>
    </form>
  );
}
