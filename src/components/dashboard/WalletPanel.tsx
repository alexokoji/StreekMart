"use client";

import { useEffect, useState } from "react";
import { Price } from "@/components/Price";
import { timeAgo } from "@/lib/utils";

type Txn = {
  id: string;
  amountCents: number;
  type: string;
  description: string;
  status: string;
  createdAt: string;
};

type WalletState = {
  balanceCents: number;
  availableCents: number;
  heldCents: number;
  pendingWithdrawalsCents: number;
  currencyCode: string;
  transactions: Txn[];
};

// Wallet view shared between /seller/wallet, /designer/wallet, and the
// buyer-side /account/wallet.
//
// `mode="seller"` shows the held-until-delivery KPI (sellers/designers).
// `mode="buyer"`  drops it (buyers don't have escrow) and reframes copy
//                 around refund credit + spending at checkout.
export function WalletPanel({ mode = "seller" }: { mode?: "seller" | "buyer" }) {
  const [state, setState] = useState<WalletState | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function refresh() {
    const res = await fetch("/api/wallet");
    if (res.ok) setState(await res.json());
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="card animate-pulse p-10 text-sm text-ink-500">Loading wallet…</div>;
  }
  if (!state) {
    return <div className="card p-10 text-sm text-burgundy-700">Couldn&apos;t load wallet.</div>;
  }

  const usableCents = state.availableCents ?? state.balanceCents;
  const heldCents = state.heldCents ?? 0;
  const isSeller = mode === "seller";
  return (
    <div className="space-y-6">
      <section
        className={`grid gap-4 sm:grid-cols-2 ${
          isSeller ? "lg:grid-cols-4" : "lg:grid-cols-3"
        }`}
      >
        <div className="card relative overflow-hidden p-6">
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-violet-200/40 blur-3xl" />
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">
            {isSeller ? "Available" : "Refund balance"}
          </p>
          <p className="mt-2 font-display text-3xl font-bold">
            <Price amount={usableCents / 100} />
          </p>
          <p className="mt-1 text-[11px] text-ink-500">
            {isSeller
              ? "Ready to withdraw."
              : "Spend at checkout or withdraw to your bank."}
          </p>
        </div>
        {isSeller && (
          <div className="card p-6">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">
              Held until delivery
            </p>
            <p className="mt-2 font-display text-2xl font-semibold text-gold-700">
              <Price amount={heldCents / 100} />
            </p>
            <p className="mt-1 text-[11px] text-ink-500">
              Released to your wallet once the buyer confirms delivery.
            </p>
          </div>
        )}
        <div className="card p-6">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">
            Processing payouts
          </p>
          <p className="mt-2 font-display text-2xl font-semibold text-ink-700">
            <Price amount={state.pendingWithdrawalsCents / 100} />
          </p>
          <p className="mt-1 text-[11px] text-ink-500">
            Withdrawals waiting on Monnify confirmation.
          </p>
        </div>
        <div className="card p-6">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">
            Withdraw
          </p>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="btn-primary mt-2 w-full"
            disabled={usableCents <= 0}
          >
            {showForm ? "Close form" : "New withdrawal"}
          </button>
          <p className="mt-2 text-[10px] text-ink-500">
            Withdrawal fee: 2%.
          </p>
        </div>
      </section>

      {showForm && (
        <PayoutForm
          maxCents={usableCents}
          onDone={() => {
            setShowForm(false);
            refresh();
          }}
        />
      )}

      <section className="card overflow-hidden">
        <header className="flex items-center justify-between border-b border-ink-100 p-4">
          <h2 className="font-display text-base font-semibold">Transactions</h2>
          <p className="text-[11px] text-ink-500">{state.transactions.length} entries</p>
        </header>
        {state.transactions.length === 0 ? (
          <p className="p-6 text-sm text-ink-500">No transactions yet.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {state.transactions.map((t) => (
              <TxnRow key={t.id} txn={t} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TxnRow({ txn }: { txn: Txn }) {
  const positive = txn.amountCents > 0;
  const dollars = Math.abs(txn.amountCents) / 100;
  return (
    <li className="flex items-center justify-between gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-medium">{txn.description}</p>
        <p className="text-[11px] text-ink-500">
          {timeAgo(txn.createdAt)} · {txn.type.toLowerCase().replace("_", " ")}
          {txn.status !== "COMPLETED" && (
            <span className="ml-2 badge bg-ink-100 text-ink-600">{txn.status}</span>
          )}
        </p>
      </div>
      <p className={`shrink-0 text-sm font-semibold ${positive ? "text-emerald-accent" : "text-burgundy-700"}`}>
        {positive ? "+" : "−"}<Price amount={dollars} />
      </p>
    </li>
  );
}

function PayoutForm({
  maxCents,
  onDone,
}: {
  maxCents: number;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState<string>(((maxCents / 100) * 0.5).toFixed(2));
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setErr("Enter a valid amount.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/wallet/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: cents, bankCode, accountNumber, accountName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Withdrawal failed.");
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <h3 className="font-display text-lg font-semibold">Withdraw to bank</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Amount (USD)</label>
          <input
            type="number"
            min={1}
            step="0.01"
            max={maxCents / 100}
            className="input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-ink-500">
            Max <Price amount={maxCents / 100} />
          </p>
        </div>
        <div>
          <label className="label">Bank code</label>
          <input
            className="input"
            value={bankCode}
            onChange={(e) => setBankCode(e.target.value)}
            placeholder="e.g. 044 (Access Bank)"
          />
        </div>
        <div>
          <label className="label">Account number</label>
          <input
            className="input"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            inputMode="numeric"
          />
        </div>
        <div>
          <label className="label">Account name</label>
          <input
            className="input"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
          />
        </div>
      </div>
      {err && <p className="text-sm text-burgundy-700">{err}</p>}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Sending to Monnify…" : "Confirm withdrawal"}
      </button>
      <p className="text-[11px] text-ink-500">
        In dev mode (MONNIFY_LIVE unset) this records a stub transaction; in
        production it disburses through Monnify.
      </p>
    </form>
  );
}
