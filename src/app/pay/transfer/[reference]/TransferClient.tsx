"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ImageUploader } from "@/components/forms/ImageUploader";

type Data = {
  reference: string;
  role: "buyer" | "seller";
  status: string | null;
  rejectReason: string | null;
  proofUrl: string | null;
  senderName: string | null;
  amount: number;
  buyer: { name: string };
  seller: { name: string; bankName: string; accountNumber: string; accountName: string };
  orders: { id: string; quantity: number; totalPrice: number; product: { name: string; image: string | null } }[];
};

const naira = (n: number) => `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function TransferClient({ reference }: { reference: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState<string[]>([]);
  const [sender, setSender] = useState("");
  const [reason, setReason] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/orders/transfer/${encodeURIComponent(reference)}`, { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) setErr(j.error || "Couldn't load this payment.");
    else setD(j);
  }, [reference]);
  useEffect(() => { void load(); }, [load]);

  async function post(path: string, body: object) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/orders/transfer/${encodeURIComponent(reference)}/${path}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setErr(j.error || "Something went wrong.");
      else await load();
    } finally { setBusy(false); }
  }

  function copy(label: string, value: string) {
    void navigator.clipboard?.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(""), 1500);
  }

  if (err && !d) return <div className="mx-auto max-w-xl p-6"><p className="card p-6 text-sm">{err}</p></div>;
  if (!d) return <div className="mx-auto max-w-xl p-6"><div className="h-64 animate-pulse rounded-2xl bg-ink-100" /></div>;

  const confirmed = d.status === "CONFIRMED";
  const Row = ({ k, v, copyable }: { k: string; v: string; copyable?: boolean }) => (
    <div className="flex items-center justify-between gap-3 border-b border-ink-100 py-2.5 last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">{k}</span>
      <span className="flex items-center gap-2 text-sm font-bold text-ink-900">
        {v}
        {copyable ? (
          <button type="button" onClick={() => copy(k, v)} className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">
            {copied === k ? "Copied" : "Copy"}
          </button>
        ) : null}
      </span>
    </div>
  );

  return (
    <div className="mx-auto max-w-xl space-y-4 p-4 sm:p-6">
      <h1 className="font-display text-2xl text-ink-900">
        {d.role === "buyer" ? "Pay by bank transfer" : "Check this payment"}
      </h1>

      <div className="card p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">This transfer pays for</p>
        <ul className="divide-y divide-ink-100">
          {d.orders.map((o) => (
            <li key={o.id} className="flex items-center gap-3 py-2">
              {o.product.image ? <img src={o.product.image} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <div className="h-12 w-12 rounded-xl bg-ink-100" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">{o.product.name}</p>
                <p className="text-xs text-ink-500">Qty {o.quantity}</p>
              </div>
              <p className="text-sm font-bold">{naira(o.totalPrice)}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="card p-4">
        <Row k="Amount" v={naira(d.amount)} copyable />
        <Row k="Bank" v={d.seller.bankName} />
        <Row k="Account number" v={d.seller.accountNumber} copyable />
        <Row k="Account name" v={d.seller.accountName} />
        <Row k="Reference" v={d.reference} copyable />
        <p className="mt-3 rounded-xl bg-violet-50 p-3 text-xs text-ink-700">
          {d.role === "buyer"
            ? <>Send exactly <b>{naira(d.amount)}</b> and put <b>{d.reference}</b> in the transfer narration or remark. That code is how {d.seller.name} matches your payment to this order.</>
            : <>Look for a credit of exactly <b>{naira(d.amount)}</b> with <b>{d.reference}</b> in the narration from {d.senderName || d.buyer.name}.</>}
        </p>
      </div>

      {confirmed ? (
        <div className="card border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Payment confirmed.{" "}
          <Link className="underline" href={d.role === "buyer" ? `/account/orders/${d.orders[0].id}` : `/seller/orders/${d.orders[0].id}`}>View the order</Link>
        </div>
      ) : null}

      {d.role === "buyer" && !confirmed ? (
        <div className="card space-y-3 p-4">
          {d.status === "PROOF_SUBMITTED" ? (
            <p className="text-sm text-ink-700">Receipt sent. {d.seller.name} will confirm once the money shows in their account. You can replace the receipt below if you uploaded the wrong one.</p>
          ) : null}
          {d.status === "REJECTED" ? (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">The seller couldn&apos;t confirm this payment: {d.rejectReason}. Upload a new receipt, or contact the seller.</p>
          ) : null}
          <label className="label">Upload your receipt</label>
          <ImageUploader value={proof} onChange={setProof} multi={false} label="Screenshot or photo of your transfer receipt." />
          <div>
            <label className="label">Name on the sending account (optional)</label>
            <input className="input" value={sender} onChange={(e) => setSender(e.target.value)} placeholder="So the seller can spot it" />
          </div>
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          <button className="btn-primary w-full" disabled={busy || proof.length === 0} onClick={() => post("proof", { proofUrl: proof[0], senderName: sender || undefined })}>
            {busy ? "Sending…" : d.status === "PROOF_SUBMITTED" ? "Replace receipt" : "I've paid, send receipt"}
          </button>
        </div>
      ) : null}

      {d.role === "seller" && !confirmed ? (
        <div className="card space-y-3 p-4">
          {d.proofUrl ? (
            <a href={d.proofUrl} target="_blank" rel="noreferrer"><img src={d.proofUrl} alt="Buyer's receipt" className="max-h-96 w-full rounded-xl border border-ink-100 object-contain" /></a>
          ) : (
            <p className="text-sm text-ink-500">The buyer hasn&apos;t uploaded a receipt yet. If the money has already reached your account you can still confirm it.</p>
          )}
          {d.senderName ? <p className="text-sm">Sender: <b>{d.senderName}</b></p> : null}
          <p className="text-xs text-ink-500">Only confirm after you&apos;ve seen the money in your bank app. A receipt image alone can be faked.</p>
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          <button className="btn-primary w-full" disabled={busy} onClick={() => post("review", { action: "confirm" })}>
            {busy ? "Working…" : "Money received, confirm payment"}
          </button>
          <div className="flex gap-2">
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (e.g. amount didn't arrive)" />
            <button className="btn-secondary" disabled={busy || !reason.trim()} onClick={() => post("review", { action: "reject", reason })}>Reject</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
