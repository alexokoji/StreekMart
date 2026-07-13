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
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
            Shop by category
          </p>
          <h2 className="font-display text-lg font-semibold sm:text-xl">
            What are you in the mood for?
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

      {/* Horizontal scroll on mobile (snap), grid on desktop — both surface
          every card without needing the user to expand a section. */}
      <div
        className="flex gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory pb-1 sm:grid sm:snap-none sm:grid-cols-4 sm:gap-3 lg:grid-cols-8"
      >
        {POPULAR.map((cat) => {
          const count = categoryCounts.get(cat.name) ?? 0;
          const isActive = activeCategory === cat.name;
          return (
            <Link
              key={cat.name}
              href={hrefFor(cat.name)}
              className={`group relative flex shrink-0 snap-center flex-col items-center justify-center rounded-2xl border bg-gradient-to-br p-3 text-center transition-all dark:border-ink-700 dark:bg-none dark:bg-ink-800 ${cat.tint} ${
                isActive
                  ? "border-violet-500 shadow-md ring-2 ring-violet-300 dark:border-violet-400 dark:ring-violet-900"
                  : "border-ink-100 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-sm dark:hover:border-violet-400"
              } w-[7.5rem] sm:w-auto`}
              aria-label={`Filter by ${cat.name}`}
            >
              <span className="text-3xl leading-none sm:text-4xl" aria-hidden="true">
                {cat.emoji}
              </span>
              <span className="mt-1.5 text-xs font-semibold text-ink-800 dark:text-white sm:text-sm">
                {cat.name}
              </span>
              <span className="mt-0.5 text-[10px] text-ink-500 dark:text-ink-400">
                {count} {count === 1 ? "item" : "items"}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
