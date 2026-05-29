"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Price } from "@/components/Price";
import { displaySellerName } from "@/lib/businessName";
import { formatQuantity, perUnitLabel, unitConfig } from "@/lib/units";

type Item = {
  id: string;
  quantity: number;
  /** Pre-formatted "Color: Blue · Size: M" string (empty when none). */
  selectedAttributesSummary: string;
  product: {
    id: string;
    name: string;
    price: number;
    salePrice: number | null;
    effectivePrice: number;
    image: string | null;
    seller: { id: string; name: string; businessName: string | null };
    stock: number;
    unit: string;
  };
};

export function CartClient({ items: initial }: { items: Item[] }) {
  const router = useRouter();
  // Local state for optimistic updates — but kept in sync with whatever the
  // server hands us on every refresh. Without this effect, a `router.refresh()`
  // re-renders the parent server component with fresh data but CartClient's
  // `useState(initial)` still holds the previous snapshot — so the row stays
  // visible after a successful remove, and the qty fields lag behind the
  // server's clamped value.
  const [items, setItems] = useState(initial);
  useEffect(() => {
    setItems(initial);
  }, [initial]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setQty(itemId: string, qty: number) {
    if (qty <= 0) return;
    setBusyId(itemId);
    try {
      const res = await fetch(`/api/cart/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: qty }),
      });
      if (res.ok) {
        setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, quantity: qty } : it)));
        // Re-render the parent so the Order Summary aside (subtotal,
        // per-seller delivery, grand total) reflects the new quantity.
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function remove(itemId: string) {
    setBusyId(itemId);
    try {
      const res = await fetch(`/api/cart/items/${itemId}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((it) => it.id !== itemId));
        router.refresh();
      } else {
        console.error("Failed to remove item:", res.status, await res.text());
      }
    } catch (err) {
      console.error("Error removing item:", err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ul className="card divide-y">
      {items.map((it) => {
        const cfg = unitConfig(it.product.unit);
        const isMeasured = it.product.unit !== "piece";
        return (
          <li key={it.id} className="flex gap-4 p-4">
            <Link href={`/products/${it.product.id}`} className="block h-24 w-24 shrink-0 overflow-hidden rounded-md bg-gray-100">
              {it.product.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.product.image} alt={it.product.name} className="h-full w-full object-cover" />
              )}
            </Link>
            <div className="flex-1 min-w-0">
              {/* `break-words` on the title + the parent's `min-w-0` keep a
                  long unbreakable product name from widening the row past
                  the viewport. */}
              <Link
                href={`/products/${it.product.id}`}
                className="block break-words font-medium hover:underline"
              >
                {it.product.name}
              </Link>
              <p className="break-words text-xs text-gray-500">
                Sold by {displaySellerName(it.product.seller)}
              </p>
              {it.selectedAttributesSummary && (
                <p className="mt-0.5 break-words text-xs font-medium text-violet-700">
                  {it.selectedAttributesSummary}
                </p>
              )}
              <p className="mt-1 text-sm">
                <span className="font-semibold"><Price amount={it.product.effectivePrice} /></span>
                {isMeasured && (
                  <span className="ml-1 text-xs text-gray-500">{perUnitLabel(it.product.unit)}</span>
                )}
                {it.product.salePrice !== null && (
                  <span className="ml-2 text-xs text-gray-400 line-through"><Price amount={it.product.price} /></span>
                )}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center rounded-md border border-gray-300">
                  <button
                    type="button"
                    className="px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-40"
                    onClick={() => setQty(it.id, Number((it.quantity - cfg.step).toFixed(2)))}
                    disabled={busyId === it.id || it.quantity <= cfg.step}
                  >
                    −
                  </button>
                  {isMeasured ? (
                    <input
                      type="number"
                      step={cfg.step}
                      min={cfg.step}
                      max={it.product.stock}
                      className="w-16 border-x border-gray-300 bg-transparent px-1 py-1 text-center text-sm focus:outline-none"
                      value={it.quantity}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v) && v > 0) setQty(it.id, Number(v.toFixed(2)));
                      }}
                    />
                  ) : (
                    <span className="min-w-[2rem] px-2 text-center text-sm">{it.quantity}</span>
                  )}
                  <button
                    type="button"
                    className="px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-40"
                    onClick={() => setQty(it.id, Number((it.quantity + cfg.step).toFixed(2)))}
                    disabled={busyId === it.id || it.quantity >= it.product.stock}
                  >
                    +
                  </button>
                </div>
                {/* Hidden on phones — the stepper number already shows the
                    quantity. The "2 pieces / yards / etc." annotation was
                    eating row width on small screens and pushing the trash
                    button off into the price column. Keep it on ≥sm where
                    space is plentiful. */}
                <span className="hidden text-xs text-ink-500 sm:inline">
                  {formatQuantity(it.quantity, it.product.unit)}
                </span>
              </div>
            </div>
            {/* Right column: trash icon on top, total below. Pulled out of
                the middle column's inner flex row so the icon's 48×48 tap
                target always lands in clear space — previous layout had it
                crammed at the right edge of the middle column, where on
                narrow phones it ran out of room and either overflowed or
                slid under the price text and stopped registering taps.
                `touch-manipulation` removes iOS's 300ms tap delay so the
                press feels immediate. */}
            <div className="flex shrink-0 flex-col items-end justify-between gap-2">
              <button
                type="button"
                aria-label="Remove item"
                className="inline-flex h-12 w-12 items-center justify-center rounded-full text-gray-500 hover:bg-red-50 hover:text-red-600 active:bg-red-100 active:text-red-700 disabled:opacity-40 [touch-action:manipulation]"
                onClick={() => remove(it.id)}
                disabled={busyId === it.id}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1.5 14a2 2 0 0 1-2 2H8.5a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
              <p className="text-right text-sm font-semibold">
                <Price amount={it.product.effectivePrice * it.quantity} />
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
