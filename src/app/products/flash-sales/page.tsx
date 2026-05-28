import { getCurrentUser } from "@/lib/auth";
import { CATEGORIES } from "@/lib/enums";
import { fetchRailPage, fetchSavedIdsFor, type RailFilters } from "@/lib/productRails";
import { InfiniteProductGrid } from "@/components/storefront/InfiniteProductGrid";
import { FilterableRailLayout } from "@/components/storefront/FilterableRailLayout";

export const metadata = {
  title: "Flash sales | StreekMart",
  description: "Limited-time discounts from sellers across the marketplace.",
};

const PAGE_SIZE = 24;
const BASE_PATH = "/products/flash-sales";

export default async function FlashSalesPage({
  searchParams,
}: {
  searchParams: { category?: string; country?: string; city?: string };
}) {
  const user = await getCurrentUser();
  const filters: RailFilters = {
    category: searchParams.category && CATEGORIES.includes(searchParams.category)
      ? searchParams.category
      : null,
    country: searchParams.country ?? null,
    city: searchParams.city ?? null,
  };
  const { items, hasMore } = await fetchRailPage("flash-sales", {
    offset: 0,
    limit: PAGE_SIZE,
    filters,
  });
  const savedIds = await fetchSavedIdsFor(user?.id, items.map((i) => i.id));

  return (
    <FilterableRailLayout
      title="🔥 Flash sales"
      subtitle="Limited-time discounts from sellers across the marketplace — grab them before they're gone."
      basePath={BASE_PATH}
      activeCategory={filters.category ?? null}
      locationFilter={{ country: filters.country ?? undefined, city: filters.city ?? undefined }}
    >
      {items.length === 0 ? (
        <p className="rounded-lg border border-ink-100 p-6 text-sm text-ink-500">
          No flash sales match the current filters.
        </p>
      ) : (
        <InfiniteProductGrid
          initialItems={items}
          initialSavedIds={savedIds}
          initialHasMore={hasMore}
          rail="flash-sales"
          cols={6}
          pageSize={PAGE_SIZE}
          filters={filters}
        />
      )}
    </FilterableRailLayout>
  );
}
