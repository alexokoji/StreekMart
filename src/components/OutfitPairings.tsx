"use client";

import { useState } from "react";
import Link from "next/link";

type Pairing = { category: string; idea: string };

export function OutfitPairings({ productId }: { productId: string }) {
  const [pairings, setPairings] = useState<Pairing[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/ai/outfit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Couldn't generate ideas.");
        return;
      }
      setPairings(data.pairings);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-700">✨ Style this with</p>
          <p className="text-xs text-gray-600">AI-generated outfit ideas tailored to this piece.</p>
        </div>
        {!pairings && (
          <button type="button" onClick={load} className="btn-primary text-xs" disabled={busy}>
            {busy ? "Thinking…" : "Get ideas"}
          </button>
        )}
      </div>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      {pairings && (
        <ul className="mt-3 space-y-2">
          {pairings.map((p, i) => (
            <li key={i} className="rounded-md bg-white p-3 text-sm">
              <Link
                href={`/search?q=${encodeURIComponent(p.idea)}`}
                className="font-medium text-brand-700 hover:underline"
              >
                {p.category}
              </Link>
              <p className="mt-0.5 text-gray-700">{p.idea}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
