// Instant placeholder shown the moment a link is clicked, while the server
// renders the next page. Keeps navigation feeling immediate.
export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-ink-100" />
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="aspect-[4/5] animate-pulse rounded-2xl bg-ink-100" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-ink-100" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-ink-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
