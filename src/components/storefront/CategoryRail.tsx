import Link from "next/link";

// Compact, dense category rail that sits to the left of the hero on desktop.
// Renders the same vocabulary as the chip rows further down the page, but
// in a vertical "Jumia / Amazon" style. Hidden below `lg` — on smaller
// screens the chip rows below the hero handle category navigation.
//
// `groups` is the live admin-managed category map (group name → list of
// category names). The parent server component fetches it via
// readCategoryGroups() and passes it down so admin-added categories
// appear here without a code change.
//
// `basePath` lets the same component drop into any page that wants to
// scope rails by category: the home page uses "/" (filters home rails in
// place), each landing page uses its own pathname (filters that rail).
//
// `activeCategory` highlights the currently-selected chip so a navigated
// user sees where they are without re-reading the URL.
export function CategoryRail({
  counts,
  groups,
  basePath = "/",
  activeCategory = null,
}: {
  counts: Map<string, number>;
  groups: Record<string, string[]>;
  basePath?: string;
  activeCategory?: string | null;
}) {
  const entries = Object.entries(groups);
  return (
    <aside className="hidden h-[420px] overflow-y-auto rounded-2xl border border-ink-100 bg-white p-3 lg:block">
      <div className="flex items-center justify-between px-2 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-500">
          Categories
        </p>
        {activeCategory && (
          <Link
            href={basePath}
            className="text-[10px] font-medium text-violet-600 hover:underline"
          >
            Clear
          </Link>
        )}
      </div>
      {entries.map(([group, items]) => (
        <div key={group} className="mb-3 last:mb-0">
          <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink-400">
            {group}
          </p>
          <ul>
            {items.map((c) => {
              const n = counts.get(c) ?? 0;
              const active = activeCategory === c;
              return (
                <li key={c}>
                  <Link
                    href={`${basePath}?category=${encodeURIComponent(c)}`}
                    className={
                      active
                        ? "flex items-center justify-between rounded-md bg-violet-50 px-2 py-1.5 text-xs font-semibold text-violet-700"
                        : "flex items-center justify-between rounded-md px-2 py-1.5 text-xs text-ink-700 transition-colors hover:bg-violet-50 hover:text-violet-700"
                    }
                    aria-current={active ? "page" : undefined}
                  >
                    <span className="line-clamp-1">{c}</span>
                    <span className="ml-2 shrink-0 text-[10px] text-ink-400">{n}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </aside>
  );
}
