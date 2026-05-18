"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { unitConfig } from "@/lib/units";

// Add-to-cart button + (optionally) a quantity stepper.
//
// `unit` controls behaviour:
//   - "piece" / "pack" / "set" / "bundle" (step 1) → integer stepper.
//   - "yard" / "meter" / "foot" / "kilogram" / "liter" (step 0.5) → fractional
//     stepper so a buyer can grab 2.5 yards of fabric.
//
// Falls back to "piece" when `unit` isn't passed, preserving the old behaviour
// for callers that haven't been updated (wishlist tiles, etc.).

export function AddToCartButton({
  productId,
  unit = "piece",
  stock,
  sizes,
  disabled,
  compact,
}: {
  productId: string;
  unit?: string;
  stock?: number;
  /** Optional list of stocked sizes. When present the buyer must pick one
   *  before adding to cart. Pass `[]` (or omit) for unsized goods. */
  sizes?: string[];
  disabled?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const cfg = unitConfig(unit);
  const [qty, setQty] = useState<number>(cfg.step);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  // Selected size when the product is sized. Required before the API call.
  const sizeOptions = sizes ?? [];
  const showSizes = sizeOptions.length > 0;
  const [selectedSize, setSelectedSize] = useState<string | null>(
    sizeOptions.length === 1 ? sizeOptions[0] : null,
  );
  const [sizeError, setSizeError] = useState(false);

  // Stepper visibility: hide for "piece" (one-click is the right UX). For
  // anything else, show — buyers need to pick how many yards / meters / etc.
  const showStepper = unit !== "piece";

  function clamp(next: number): number {
    const max = stock ?? 1000;
    return Math.max(cfg.step, Math.min(max, Number(next.toFixed(2))));
  }

  async function add() {
    if (showSizes && !selectedSize) {
      setSizeError(true);
      return;
    }
    setSizeError(false);
    setBusy(true);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: qty, size: selectedSize ?? undefined }),
      });
      if (res.status === 401) {
        router.push("/login?redirect=" + encodeURIComponent(window.location.pathname));
        return;
      }
      if (res.ok) {
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
        window.dispatchEvent(new CustomEvent("upclo:cart-changed"));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Couldn't add to cart");
      }
    } finally {
      setBusy(false);
    }
  }

  if (disabled) {
    return (
      <button disabled className={`btn-secondary ${compact ? "text-xs" : ""} opacity-60`}>
        Your listing
      </button>
    );
  }

  return (
    <div className={`flex w-full flex-col gap-2 ${compact ? "text-xs" : ""}`}>
      {showSizes && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-ink-500">
            Size
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sizeOptions.map((s) => {
              const on = selectedSize === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSelectedSize(s);
                    setSizeError(false);
                  }}
                  className={`min-w-[2.5rem] rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    on
                      ? "border-violet-500 bg-violet-600 text-white"
                      : "border-ink-200 bg-white text-ink-700 hover:border-violet-300"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
          {sizeError && (
            <p className="mt-1.5 text-xs font-medium text-burgundy-700">
              Pick a size to continue.
            </p>
          )}
        </div>
      )}
      {showStepper && (
        <div className="flex items-center gap-2 text-sm">
          <div className="inline-flex items-center rounded-md border border-ink-200">
            <button
              type="button"
              className="px-2 py-1 text-sm hover:bg-ink-50 disabled:opacity-40"
              onClick={() => setQty((q) => clamp(q - cfg.step))}
              disabled={busy || qty <= cfg.step}
            >
              −
            </button>
            <input
              type="number"
              className="w-20 border-x border-ink-200 bg-transparent px-2 py-1 text-center text-sm focus:outline-none"
              value={qty}
              min={cfg.step}
              max={stock ?? undefined}
              step={cfg.step}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) setQty(clamp(v));
              }}
            />
            <button
              type="button"
              className="px-2 py-1 text-sm hover:bg-ink-50 disabled:opacity-40"
              onClick={() => setQty((q) => clamp(q + cfg.step))}
              disabled={busy || (stock !== undefined && qty >= stock)}
            >
              +
            </button>
          </div>
          <span className="text-xs text-ink-500">
            {qty === 1 ? cfg.longLabel : cfg.pluralLong}
          </span>
        </div>
      )}
      <button
        type="button"
        className={`btn-primary w-full ${compact ? "text-xs" : ""}`}
        disabled={busy}
        onClick={add}
      >
        {busy ? "Adding…" : added ? "✓ Added" : "Add to cart"}
      </button>
    </div>
  );
}
