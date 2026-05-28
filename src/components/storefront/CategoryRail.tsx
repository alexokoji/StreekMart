import Link from "next/link";
import { CATEGORY_GROUPS } from "@/lib/enums";

// Compact, dense category rail that sits to the left of the hero on desktop.
// Renders the same vocabulary as the chip rows further down the page, but
// in a vertical "Jumia / Amazon" style. Hidden below `lg` — on smaller
// screens the chip rows below the hero handle category navigation.
//
// `basePath` lets the same component drop into any page that wants to
// scope rails by category: the home page uses "/" (filters home rails in
// place), each landing page uses its own pathname (filters that rail).
// Defaults to "/" so existing call sites don't break.
//
// `activeCategory` highlights the currently-selected chip so a navigated
// user sees where they are without re-reading the URL.
export function CategoryRail({
  counts,
  basePath = "/",
  activeCategory = null,
}: {
  counts: Map<string, number>;
  basePath?: string;
  activeCategory?: string | null;
}) {
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
      {(Object.entries(CATEGORY_GROUPS) as ReadonlyArray<readonly [string, readonly string[]]>).map(
        ([group, items]) => (
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
        ),
      )}
    </aside>
  );
}
