import { getCurrentUser } from "@/lib/auth";
import { fetchRailPage, fetchSavedIdsFor, type RailFilters } from "@/lib/productRails";
import { InfiniteProductGrid } from "@/components/storefront/InfiniteProductGrid";
import { FilterableRailLayout } from "@/components/storefront/FilterableRailLayout";

export const metadata = {
  title: "New arrivals | StreekMart",
  description: "Fresh listings, just in.",
};

const PAGE_SIZE = 24;
const BASE_PATH = "/products/new-arrivals";

export default async function NewArrivalsPage({
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
  const { items, hasMore } = await fetchRailPage("new-arrivals", {
    offset: 0,
    limit: PAGE_SIZE,
    filters,
  });
  const savedIds = await fetchSavedIdsFor(user?.id, items.map((i) => i.id));

  return (
    <FilterableRailLayout
      title="New arrivals"
      subtitle="The latest listings from sellers and designers — freshly added to the marketplace."
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
          rail="new-arrivals"
          cols={6}
          pageSize={PAGE_SIZE}
          filters={filters}
        />
      )}
    </FilterableRailLayout>
  );
}
