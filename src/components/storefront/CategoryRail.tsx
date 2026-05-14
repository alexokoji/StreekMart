import Link from "next/link";
import { CATEGORY_GROUPS } from "@/lib/enums";

// Compact, dense category rail that sits to the left of the hero on desktop.
// Renders the same vocabulary as the chip rows further down the page, but
// in a vertical "Jumia / Amazon" style. Hidden below `lg` — on smaller
// screens the chip rows below the hero handle category navigation.
export function CategoryRail({ counts }: { counts: Map<string, number> }) {
  return (
    <aside className="hidden h-[420px] overflow-y-auto rounded-2xl border border-ink-100 bg-white p-3 lg:block">
      <div className="px-2 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-500">
          Categories
        </p>
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
                return (
                  <li key={c}>
                    <Link
                      href={`/feed?category=${encodeURIComponent(c)}`}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs text-ink-700 transition-colors hover:bg-violet-50 hover:text-violet-700"
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
