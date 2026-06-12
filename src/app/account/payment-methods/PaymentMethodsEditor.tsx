"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Method = {
  id: string;
  gateway: string;
  maskedPan: string | null;
  brand: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
};

export function PaymentMethodsEditor({ initial }: { initial: Method[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Method[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function setDefault(id: string) {
    setBusy(id);
    try {
      await fetch(`/api/payment-methods/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      setRows((r) => r.map((x) => ({ ...x, isDefault: x.id === id })));
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Forget this card?")) return;
    setBusy(id);
    try {
      await fetch(`/api/payment-methods/${id}`, { method: "DELETE" });
      setRows((r) => r.filter((x) => x.id !== id));
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="card p-6 text-center text-sm text-ink-500">
        No saved cards yet. At your next checkout, tick &ldquo;Save this card&rdquo; to add one here.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((m) => (
        <li key={m.id} className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{m.brand ?? "Card"}</span>
                {m.isDefault && <span className="badge bg-emerald-50 text-emerald-700">Default</span>}
              </div>
              <p className="mt-1 font-mono text-sm text-ink-700">{m.maskedPan ?? "----  ----  ----  ----"}</p>
              {m.expMonth && m.expYear && (
                <p className="text-xs text-ink-500">
                  Expires {String(m.expMonth).padStart(2, "0")}/{m.expYear}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-1 text-xs">
              {!m.isDefault && (
                <button onClick={() => setDefault(m.id)} disabled={busy === m.id} className="text-violet-700 hover:underline">
                  Set default
                </button>
              )}
              <button onClick={() => remove(m.id)} disabled={busy === m.id} className="text-burgundy-700 hover:underline">
                Forget card
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}