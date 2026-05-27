import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { fetchRailPage, fetchSavedIdsFor } from "@/lib/productRails";
import { InfiniteProductGrid } from "@/components/storefront/InfiniteProductGrid";

export const metadata = {
  title: "Best sellers | StreekMart",
  description: "What buyers keep coming back for.",
};

const PAGE_SIZE = 24;

export default async function BestSellersPage() {
  const user = await getCurrentUser();
  const { items, hasMore } = await fetchRailPage("best-sellers", {
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
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Best sellers</h1>
        <p className="text-sm text-ink-500">
          The products buyers keep coming back for — ranked by total sales.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-ink-100 p-6 text-sm text-ink-500">
          No best-sellers yet.
        </p>
      ) : (
        <InfiniteProductGrid
          initialItems={items}
          initialSavedIds={savedIds}
          initialHasMore={hasMore}
          rail="best-sellers"
          cols={6}
          pageSize={PAGE_SIZE}
        />
      )}
    </div>
  );
}
