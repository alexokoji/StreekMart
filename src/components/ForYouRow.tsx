"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Price } from "@/components/Price";

type Item =
  | {
      kind: "product";
      id: string;
      reason: string;
      data: {
        name: string;
        price: number;
        category: string;
        image: string | null;
        seller: string;
        href: string;
      };
    }
  | {
      kind: "post";
      id: string;
      reason: string;
      data: { title: string; image: string | null; author: string; href: string };
    };

export function ForYouRow() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [cold, setCold] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ai/recommendations");
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (!cancelled) setErr(data.error ?? "Couldn't load recommendations.");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        setCold(!!data.cold);
      } catch {
        if (!cancelled) setErr("Network error.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (err || (items && items.length === 0)) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {cold ? "Trending right now" : "✨ Picked for you"}
          </h2>
          <p className="text-xs text-gray-500">
            {cold
              ? "Like or save a few items to personalize your feed."
              : "Curated by AI based on what you've liked and saved."}
          </p>
        </div>
      </div>

      {!items ? (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card aspect-[3/4] animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {items.map((it) => (
            <Link
              key={`${it.kind}-${it.id}`}
              href={it.data.href}
              className="card group overflow-hidden transition-transform hover:-translate-y-0.5"
            >
              <div className="aspect-square bg-gray-100">
                {it.data.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.data.image}
                    alt={it.kind === "product" ? it.data.name : it.data.title}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="p-3">
                <p className="line-clamp-1 text-sm font-medium">
                  {it.kind === "product" ? it.data.name : it.data.title}
                </p>
                {it.kind === "product" && (
                  <p className="text-xs text-gray-600"><Price amount={it.data.price} /></p>
                )}
                <p className="mt-1 line-clamp-2 text-[11px] italic text-brand-700">
                  {it.reason}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
