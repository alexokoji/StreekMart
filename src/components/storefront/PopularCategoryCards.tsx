import Link from "next/link";

// Visual quick-filter rail for the most-shopped categories. Mounted near
// the top of the home page so buyers can jump to "Dresses" or "Ankara" in
// one tap without scrolling through every rail first.
//
// Each card writes `?category=…` to the URL, which the home page reads and
// uses to narrow every product rail (flash sales, new arrivals, etc.).
// Active state highlights the chosen filter so the buyer knows what's
// applied.
//
// Curated set rather than every category — too many cards reads as
// overwhelming, and the long-tail categories already have a home on the
// sidebar / search page.

const POPULAR: Array<{ name: string; emoji: string; tint: string }> = [
  { name: "Ankara",      emoji: "🌺", tint: "from-fuchsia-100 to-rose-50" },
  { name: "Lace",        emoji: "🎀", tint: "from-violet-100 to-pink-50" },
  { name: "Dresses",     emoji: "👗", tint: "from-rose-100 to-amber-50" },
  { name: "Tops",        emoji: "👕", tint: "from-sky-100 to-blue-50" },
  { name: "Native Wear", emoji: "🪡", tint: "from-amber-100 to-yellow-50" },
  { name: "Shoes",       emoji: "👠", tint: "from-violet-100 to-fuchsia-50" },
  { name: "Bags",        emoji: "👜", tint: "from-emerald-100 to-teal-50" },
  { name: "Jewelry",     emoji: "💍", tint: "from-amber-100 to-orange-50" },
];

export function PopularCategoryCards({
  activeCategory,
  categoryCounts,
  preserveSearchParams,
}: {
  activeCategory: string | null;
  categoryCounts: Map<string, number>;
  // Forward existing `?country=` / `?city=` filters when changing category
  // so the buyer's location narrow doesn't get cleared.
  preserveSearchParams: URLSearchParams;
}) {
  function hrefFor(category: string | null): string {
    const sp = new URLSearchParams(preserveSearchParams);
    if (category === null || category === activeCategory) {
      sp.delete("category");
    } else {
      sp.set("category", category);
    }
    const qs = sp.toString();
    return qs ? `/?${qs}` : "/";
  }

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
            Shop by category
          </p>
          <h2 className="font-display text-xl font-bold sm:text-2xl">
            Find your style
          </h2>
        </div>
        {activeCategory && (
          <Link
            href={hrefFor(null)}
            className="shrink-0 text-xs text-violet-700 hover:underline"
          >
            Clear filter
          </Link>
        )}
      </div>

      {/* Circular avatar-style pickers — image (or tinted emoji fallback)
          in a round frame, label underneath. Horizontal scroll on mobile
          (snap), even row on desktop. */}
      <div className="flex gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory pb-1 sm:grid sm:snap-none sm:grid-cols-4 sm:gap-4 lg:grid-cols-8">
        {POPULAR.map((cat) => {
          const count = categoryCounts.get(cat.name) ?? 0;
          const isActive = activeCategory === cat.name;
          return (
            <Link
              key={cat.name}
              href={hrefFor(cat.name)}
              className="group flex shrink-0 snap-center flex-col items-center gap-2 text-center w-20 sm:w-auto"
              aria-label={`Filter by ${cat.name}`}
            >
              <span
                className={`flex h-16 w-16 items-center justify-center rounded-full border bg-gradient-to-br text-2xl transition-all sm:h-20 sm:w-20 sm:text-3xl dark:border-ink-700 dark:bg-none dark:bg-ink-800 ${cat.tint} ${
                  isActive
                    ? "border-violet-500 shadow-md ring-2 ring-violet-300 dark:border-violet-400 dark:ring-violet-900"
                    : "border-ink-100 group-hover:-translate-y-0.5 group-hover:border-violet-300 group-hover:shadow-sm dark:hover:border-violet-400"
                }`}
                aria-hidden="true"
              >
                {cat.emoji}
              </span>
              <span className="text-xs font-semibold text-ink-800 dark:text-white sm:text-sm">
                {cat.name}
              </span>
              <span className="text-[10px] text-ink-500 dark:text-ink-400">
                {count} {count === 1 ? "item" : "items"}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
