"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Price } from "@/components/Price";

type Item = {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string;
  image: string | null;
  seller: { id: string; name: string };
  likeCount: number;
};

type Plan = {
  categories: string[];
  keywords: string[];
  materials?: string[];
  colors?: string[];
  occasion?: string | null;
  max_price: number | null;
  rationale: string;
};

const SAMPLES = [
  "a linen shirt I can wear to a beach wedding",
  "monochrome streetwear under $120",
  "something cozy for fall layering",
  "elegant accessories for a black-tie event",
];

export function SmartSearchClient({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  // Auto-run if we landed here with a query in the URL.
  useEffect(() => {
    if (initialQuery && initialQuery.length >= 2) {
      run(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  async function run(q: string) {
    if (!q.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Search failed");
        setPlan(null);
        setItems([]);
        return;
      }
      setPlan(data.plan);
      setItems(data.items ?? []);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(query);
        }}
        className="flex gap-2"
      >
        <input
          className="input flex-1"
          placeholder="Describe what you want…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={busy}
        />
        <button type="submit" className="btn-primary" disabled={busy || !query.trim()}>
          {busy ? "Searching…" : "Search"}
        </button>
      </form>

      {!plan && !err && (
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setQuery(s);
                run(s);
              }}
              className="rounded-full border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:border-brand-500 hover:bg-brand-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {err && <p className="text-sm text-red-600">{err}</p>}

      {plan && (
        <div className="card p-4">
          <p className="text-sm text-gray-700">{plan.rationale}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {plan.categories.map((c) => (
              <span key={c} className="badge bg-brand-50 text-brand-700">{c}</span>
            ))}
            {plan.max_price !== null && (
              <span className="badge bg-gray-100 text-gray-700">≤ <Price amount={plan.max_price} /></span>
            )}
            {plan.keywords.slice(0, 6).map((k) => (
              <span key={k} className="badge bg-gray-100 text-gray-700">{k}</span>
            ))}
            {plan.colors?.map((c) => (
              <span key={`color-${c}`} className="badge bg-amber-50 text-amber-700">{c}</span>
            ))}
            {plan.occasion && (
              <span className="badge bg-violet-50 text-violet-700">{plan.occasion}</span>
            )}
          </div>
        </div>
      )}

      {plan && items.length === 0 && (
        <div className="card p-8 text-center text-gray-500">
          No matches yet — try widening your description.
        </div>
      )}

      {items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <Link
              key={p.id}
              href={`/products/${p.id}`}
              className="card overflow-hidden transition-transform hover:-translate-y-0.5"
            >
              <div className="aspect-square bg-gray-100">
                {p.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-4">
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-gray-600"><Price amount={p.price} /></p>
                <p className="mt-1 text-xs text-gray-500">{p.category} · by {p.seller.name}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
