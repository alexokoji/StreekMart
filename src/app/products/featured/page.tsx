import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { fetchRailPage, fetchSavedIdsFor } from "@/lib/productRails";
import { InfiniteProductGrid } from "@/components/storefront/InfiniteProductGrid";

export const metadata = {
  title: "Featured pieces | StreekMart",
  description: "Ranked by engagement, sales, and active promotions.",
};

const PAGE_SIZE = 24;

export default async function FeaturedPage() {
  const user = await getCurrentUser();
  const { items, hasMore } = await fetchRailPage("featured", {
    offset: 0,
    limit: PAGE_SIZE,
  });
  const savedIds = await fetchSavedIdsFor(user?.id, items.map((i) => i.id));

  return (
    <div className="space-y-6 pb-12">
      <div className="space-y-2">
        <Link href="/" className="text-sm text-brand-700 hover:underline">
          ← Back home
        </Link>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Featured pieces</h1>
        <p className="text-sm text-ink-500">
          Ranked by engagement, sales, and active promotions across the marketplace.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-ink-100 p-6 text-sm text-ink-500">
          No products to feature yet.
        </p>
      ) : (
        <InfiniteProductGrid
          initialItems={items}
          initialSavedIds={savedIds}
          initialHasMore={hasMore}
          rail="featured"
          cols={4}
          pageSize={PAGE_SIZE}
        />
      )}
    </div>
  );
}
