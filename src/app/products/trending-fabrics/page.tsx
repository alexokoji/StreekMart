import { getCurrentUser } from "@/lib/auth";
import { fetchRailPage, fetchSavedIdsFor, type RailFilters } from "@/lib/productRails";
import { InfiniteProductGrid } from "@/components/storefront/InfiniteProductGrid";
import { FilterableRailLayout } from "@/components/storefront/FilterableRailLayout";

export const metadata = {
  title: "Trending fabrics | StreekMart",
  description: "Yardage and rolls from independent sellers, ranked by buyer interest.",
};

const PAGE_SIZE = 24;
const BASE_PATH = "/products/trending-fabrics";

export default async function TrendingFabricsPage({
  searchParams,
}: {
  searchParams: { category?: string; country?: string; city?: string };
}) {
  const user = await getCurrentUser();
  const filters: RailFilters = {
    category: searchParams.category ?? null,
    country: searchParams.country ?? null,
    city: searchParams.city ?? null,
  };
  const { items, hasMore } = await fetchRailPage("trending-fabrics", {
    offset: 0,
    limit: PAGE_SIZE,
    filters,
  });
  const savedIds = await fetchSavedIdsFor(user?.id, items.map((i) => i.id));

  return (
    <FilterableRailLayout
      title="Trending fabrics"
      subtitle="Yardage and rolls from independent sellers — ranked by buyer interest."
      basePath={BASE_PATH}
      activeCategory={filters.category ?? null}
      locationFilter={{ country: filters.country ?? undefined, city: filters.city ?? undefined }}
    >
      {items.length === 0 ? (
        <p className="rounded-lg border border-ink-100 p-6 text-sm text-ink-500">
          No fabrics match the current filters.
        </p>
      ) : (
        <InfiniteProductGrid
          initialItems={items}
          initialSavedIds={savedIds}
          initialHasMore={hasMore}
          rail="trending-fabrics"
          cols={6}
          pageSize={PAGE_SIZE}
          filters={filters}
        />
      )}
    </FilterableRailLayout>
  );
}
