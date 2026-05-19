"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Price } from "@/components/Price";

export type PromotionSlide = {
  promotionId: string;
  productId: string;
  name: string;
  image: string | null;
  price: number;
  salePrice: number | null;
  sellerName: string;
  category: string;
};

// Top-of-homepage slider that cycles through admin-approved paid
// promotions. Sits above the "Featured pieces" rail. Auto-advances every
// ~5s; tapping the image deep-links to the product page.
//
// Rendering is intentionally tolerant of empty image arrays — a missing
// cover image falls back to a gradient with the product name so the slot
// doesn't collapse mid-rotation and shift the layout.
export function PromotionSlider({ slides }: { slides: PromotionSlide[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 5000);
    return () => clearInterval(id);
  }, [slides.length]);

  if (slides.length === 0) return null;
  const active = slides[index] ?? slides[0];
  if (!active) return null;

  return (
    <section aria-label="Promoted products" className="relative">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold sm:text-xl">
            ✨ Promoted right now
          </h2>
          <p className="text-xs text-ink-500">
            Paid placements from sellers — approved by the StreekMart team.
          </p>
        </div>
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-widest text-violet-700">
          {index + 1} / {slides.length}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-violet-100 bg-g-aurora shadow-soft">
        <Link
          key={active.promotionId}
          href={`/products/${active.productId}`}
          className="block"
        >
          <div className="grid h-[260px] grid-cols-1 sm:h-[320px] md:h-[360px] md:grid-cols-[1fr_1.1fr]">
            {/* Image side */}
            <div className="relative overflow-hidden bg-violet-900/40">
              {active.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={active.image}
                  alt={active.name}
                  className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-violet-700 to-fuchsia-600 px-6 text-center font-display text-xl font-semibold text-white">
                  {active.name}
                </div>
              )}
              <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-violet-700">
                <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
                Promoted
              </span>
            </div>

            {/* Copy side */}
            <div className="relative flex flex-col justify-center gap-3 px-6 py-6 text-white sm:px-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold-200">
                {active.category}
              </p>
              <h3 className="font-display text-2xl font-bold leading-tight sm:text-3xl">
                {active.name}
              </h3>
              <p className="text-sm text-white/85">by {active.sellerName}</p>
              <p className="font-display text-2xl font-bold text-gold-200">
                {active.salePrice !== null && active.salePrice < active.price ? (
                  <>
                    <Price amount={active.salePrice} />
                    <span className="ml-2 text-sm font-medium text-white/60 line-through">
                      <Price amount={active.price} />
                    </span>
                  </>
                ) : (
                  <Price amount={active.price} />
                )}
              </p>
              <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur hover:bg-white/25">
                View product →
              </span>
            </div>
          </div>
        </Link>

        {/* Pager dots — only shown when there's more than one slide. */}
        {slides.length > 1 && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.promotionId}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setIndex(i);
                }}
                aria-label={`Show promotion ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
