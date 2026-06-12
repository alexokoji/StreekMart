import Link from "next/link";
import { buildWatermarkedUrl } from "@/lib/cloudinaryUrl";

export type PreorderDesignCard = {
  postId: string;
  title: string;
  image: string | null;
  priceCents: number;
  leadDays: number;
  designerSlug: string | null;
  designerId: string;
  designerName: string;
};

// Horizontal rail of preorderable designer posts surfaced on the home page.
// Same compact layout idiom as the flash-sales carousel — fits 2.5 cards on
// mobile so the next card peeks past the right edge, hinting "swipe me".
export function PreorderDesignsRail({
  title = "Preorder designs",
  subtitle = "Custom pieces from designers you've engaged with — request now, pay delivery once it's ready.",
  items,
}: {
  title?: string;
  subtitle?: string;
  items: PreorderDesignCard[];
}) {
  if (!items.length) return null;
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold sm:text-xl">{title}</h2>
          <p className="text-xs text-ink-500">{subtitle}</p>
        </div>
        <Link
          href="/feed?preorder=1"
          className="shrink-0 whitespace-nowrap text-xs text-violet-700 hover:underline sm:text-sm"
        >
          See all →
        </Link>
      </div>
      <div className="-mx-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-2 scrollbar-thin">
        {items.map((c) => (
          <Link
            key={c.postId}
            href={`/preorder/${c.postId}`}
            className="card group snap-start w-[170px] shrink-0 overflow-hidden p-0 transition hover:border-violet-400 sm:w-[200px]"
          >
            <div className="aspect-[3/4] w-full overflow-hidden bg-ink-100">
              {c.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={buildWatermarkedUrl(c.image)}
                  alt={c.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              )}
            </div>
            <div className="p-2.5">
              <p className="line-clamp-1 text-sm font-semibold">{c.title}</p>
              {/* nested Link removed */}
              <p className="line-clamp-1 text-[11px] text-ink-500">{c.designerName}</p>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-sm font-bold text-violet-700">
                  ₦{(c.priceCents / 100).toLocaleString("en-NG")}
                </span>
                <span className="text-[10px] font-medium text-ink-500">
                  ~{c.leadDays}d
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
