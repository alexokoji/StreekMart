import Link from "next/link";
import { Price } from "@/components/Price";
import type { ProductCardData } from "./ProductCard";

// Horizontal scroll-snap carousel for the homepage "Flash sales" rail.
// Replaces the prior CardGrid for this section so:
//   - More items fit at a glance without pushing the next section below
//     the fold.
//   - The cards are intentionally smaller (~144px wide) — buyers scan a
//     long row of sale items instead of reading detail on each one.
//   - Touch swipe + trackpad horizontal scroll + shift+wheel all work
//     via native `overflow-x-auto`, no JS or extra deps.
//
// `seeAllHref` is a tail card at the end of the row so a buyer who's
// scrolled through the visible set has an obvious "more →" CTA.
export function FlashSalesCarousel({
  items,
  seeAllHref,
}: {
  items: ProductCardData[];
  seeAllHref: string;
}) {
  return (
    <div
      className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
      style={{ touchAction: "pan-x" }}
    >
      {items.map((p) => (
        <FlashCard key={p.id} p={p} />
      ))}
      <Link
        href={seeAllHref}
        className="flex shrink-0 snap-center flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-violet-300 bg-violet-50/40 px-4 text-center text-xs font-semibold text-violet-700 hover:bg-violet-100 w-[8.5rem] sm:w-[9.5rem]"
      >
        <span className="text-2xl">→</span>
        See all flash sales
      </Link>
    </div>
  );
}

function FlashCard({ p }: { p: ProductCardData }) {
  const effective = p.salePrice ?? p.price;
  const onSale = p.salePrice !== null && p.salePrice < p.price;
  const discount = onSale ? Math.round(((p.price - effective) / p.price) * 100) : 0;

  return (
    <Link
      href={`/products/${p.id}`}
      // 144 → 160px wide. snap-center so each card lands at the centre of
      // the scroller after a swipe, matching native marketplace patterns.
      className="group relative block w-[9rem] shrink-0 snap-center overflow-hidden rounded-xl border border-ink-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:w-[10rem]"
    >
      <div className="relative aspect-square bg-ink-50">
        {p.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.image}
            alt={p.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        )}
        {onSale && discount > 0 && (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
            −{discount}%
          </span>
        )}
      </div>
      <div className="p-2">
        <p className="line-clamp-1 text-xs font-medium text-ink-800">{p.name}</p>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-sm font-bold text-red-700">
            <Price amount={effective} />
          </span>
          {onSale && (
            <span className="text-[10px] text-ink-400 line-through">
              <Price amount={p.price} />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
