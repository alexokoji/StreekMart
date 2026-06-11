import { getCurrentUser } from "@/lib/auth";
import { fetchRailPage, fetchSavedIdsFor, type RailFilters } from "@/lib/productRails";
import { InfiniteProductGrid } from "@/components/storefront/InfiniteProductGrid";
import { FilterableRailLayout } from "@/components/storefront/FilterableRailLayout";

export const metadata = {
  title: "Featured pieces | StreekMart",
  description: "Ranked by engagement, sales, and active promotions.",
};

const PAGE_SIZE = 24;
const BASE_PATH = "/products/featured";

export default async function FeaturedPage({
  searchParams,
}: {
  searchParams: { category?: string; country?: string; city?: string };
}) {
  const user = await getCurrentUser();
  const filters: RailFilters = {
    // Category validation lives in productRails.normalizeFilters now —
    // any non-empty string passes; bogus values just return an empty grid.
    category: searchParams.category ?? null,
    country: searchParams.country ?? null,
    city: searchParams.city ?? null,
  };
  const { items, hasMore } = await fetchRailPage("featured", {
    offset: 0,
    limit: PAGE_SIZE,
    filters,
  });
  const savedIds = await fetchSavedIdsFor(user?.id, items.map((i) => i.id));

  return (
    <FilterableRailLayout
      title="Featured pieces"
      subtitle="Ranked by engagement, sales, and active promotions across the marketplace."
      basePath={BASE_PATH}
      activeCategory={filters.category ?? null}
      locationFilter={{ country: filters.country ?? undefined, city: filters.city ?? undefined }}
    >
      {items.length === 0 ? (
        <p className="rounded-lg border border-ink-100 p-6 text-sm text-ink-500">
          No products match the current filters.
        </p>
      ) : (
        <InfiniteProductGrid
          initialItems={items}
          initialSavedIds={savedIds}
          initialHasMore={hasMore}
          rail="featured"
          cols={4}
          pageSize={PAGE_SIZE}
          filters={filters}
        />
      )}
    </FilterableRailLayout>
  );
}
