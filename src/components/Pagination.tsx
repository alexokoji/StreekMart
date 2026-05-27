import Link from "next/link";

/**
 * Server-friendly page-number pagination. Renders Previous / page N of M /
 * Next links that point at `?page=N` on the same path. Designed to work
 * inside server components — no client state.
 *
 * Hides itself entirely when there's only one page to show.
 */
export function Pagination({
  page,
  totalPages,
  basePath,
  extraQuery,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  // Preserve other query params on the URL when paginating (e.g. category
  // filters). Pass `?` and `&` separators are handled here.
  extraQuery?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const safePage = Math.min(Math.max(1, page), totalPages);
  const hasPrev = safePage > 1;
  const hasNext = safePage < totalPages;

  function hrefFor(p: number): string {
    const params = new URLSearchParams();
    if (extraQuery) {
      for (const [k, v] of Object.entries(extraQuery)) {
        if (v) params.set(k, v);
      }
    }
    params.set("page", String(p));
    return `${basePath}?${params.toString()}`;
  }

  // Compact numbered list: first, prev, current ± 1, next, last — with ellipses
  // when there's a gap. Keeps the bar narrow on mobile while still letting
  // users jump to any nearby page.
  const visible: (number | "…")[] = [];
  const add = (n: number) => {
    if (n < 1 || n > totalPages) return;
    if (visible[visible.length - 1] === n) return;
    visible.push(n);
  };
  add(1);
  if (safePage - 1 > 2) visible.push("…");
  add(safePage - 1);
  add(safePage);
  add(safePage + 1);
  if (safePage + 1 < totalPages - 1) visible.push("…");
  add(totalPages);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-center gap-1 pt-4"
    >
      {hasPrev ? (
        <Link
          href={hrefFor(safePage - 1)}
          className="rounded border border-ink-200 px-3 py-1.5 text-sm hover:bg-ink-50"
        >
          ← Previous
        </Link>
      ) : (
        <span className="rounded border border-ink-100 px-3 py-1.5 text-sm text-ink-300">
          ← Previous
        </span>
      )}

      {visible.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-2 text-sm text-ink-400">
            …
          </span>
        ) : p === safePage ? (
          <span
            key={p}
            aria-current="page"
            className="rounded border border-violet-500 bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-700"
          >
            {p}
          </span>
        ) : (
          <Link
            key={p}
            href={hrefFor(p)}
            className="rounded border border-ink-200 px-3 py-1.5 text-sm hover:bg-ink-50"
          >
            {p}
          </Link>
        ),
      )}

      {hasNext ? (
        <Link
          href={hrefFor(safePage + 1)}
          className="rounded border border-ink-200 px-3 py-1.5 text-sm hover:bg-ink-50"
        >
          Next →
        </Link>
      ) : (
        <span className="rounded border border-ink-100 px-3 py-1.5 text-sm text-ink-300">
          Next →
        </span>
      )}
    </nav>
  );
}
