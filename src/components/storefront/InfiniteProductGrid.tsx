"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CardGrid } from "./CardGrid";
import type { ProductCardData } from "./ProductCard";
import type { RailKey, RailFilters } from "@/lib/productRails";

/**
 * Renders the initial server-fetched batch of products and lazy-loads more
 * as the user scrolls. Uses IntersectionObserver on a sentinel below the
 * grid; each fire calls /api/products/list with the next offset.
 *
 * Server-side first paint stays SEO-friendly — the sentinel only kicks in
 * after hydration.
 */
export function InfiniteProductGrid({
  initialItems,
  initialSavedIds,
  initialHasMore,
  rail,
  cols,
  pageSize = 24,
  filters,
}: {
  initialItems: ProductCardData[];
  initialSavedIds: string[];
  initialHasMore: boolean;
  rail: RailKey;
  cols: 4 | 6;
  pageSize?: number;
  // When the page is filtered (?category=…&country=…&city=…), forward
  // those onto the load-more API call so additional pages keep the same
  // scope. Without this, the first batch is filtered but subsequent
  // batches leak unfiltered products into the grid.
  filters?: RailFilters;
}) {
  const [items, setItems] = useState<ProductCardData[]>(initialItems);
  const [savedSet, setSavedSet] = useState<Set<string>>(
    () => new Set(initialSavedIds),
  );
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        rail,
        offset: String(items.length),
        limit: String(pageSize),
      });
      if (filters?.category) params.set("category", filters.category);
      if (filters?.country) params.set("country", filters.country);
      if (filters?.city) params.set("city", filters.city);
      const res = await fetch(`/api/products/list?${params.toString()}`);
      if (!res.ok) {
        setError("Couldn't load more products. Try again.");
        return;
      }
      const data = await res.json();
      const newItems: ProductCardData[] = Array.isArray(data.items) ? data.items : [];
      const newSavedIds: string[] = Array.isArray(data.savedIds) ? data.savedIds : [];
      if (newItems.length > 0) {
        setItems((prev) => [...prev, ...newItems]);
        if (newSavedIds.length > 0) {
          setSavedSet((prev) => {
            const next = new Set(prev);
            for (const id of newSavedIds) next.add(id);
            return next;
          });
        }
      }
      setHasMore(!!data.hasMore);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }, [items.length, hasMore, loading, rail, pageSize, filters?.category, filters?.country, filters?.city]);

  // IntersectionObserver: fire loadMore when the sentinel becomes visible.
  // rootMargin pre-loads slightly before it's actually in view so the user
  // doesn't see a flicker at the end of the list.
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          loadMore();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <>
      <CardGrid items={items} savedSet={savedSet} cols={cols} />

      {hasMore && (
        <div
          ref={sentinelRef}
          className="flex h-24 items-center justify-center text-sm text-ink-500"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
              Loading more…
            </span>
          ) : error ? (
            <button
              type="button"
              onClick={loadMore}
              className="text-violet-600 underline"
            >
              {error} Retry
            </button>
          ) : (
            <span className="text-ink-300">Scroll to load more</span>
          )}
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <p className="py-8 text-center text-xs text-ink-400">
          You&apos;ve reached the end.
        </p>
      )}
    </>
  );
}
