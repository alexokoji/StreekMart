import Link from "next/link";
import { ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseJsonArray, timeAgo } from "@/lib/utils";
import { Price } from "@/components/Price";
import { ProductStatusToggle } from "@/components/ProductStatusToggle";
import { productLimitFor } from "@/lib/tiers";

export default async function SellerProductsPage() {
  const user = await requireUser("SELLER");
  const products = await prisma.product.findMany({
    where: { sellerId: user.id },
    orderBy: { createdAt: "desc" },
  });

  // Tier-cap surface so sellers know how much headroom they have. Only
  // ACTIVE listings count against the cap; drafts and archived rows are
  // free real estate.
  const tier = user.sellerTier ?? 1;
  const limit = productLimitFor(tier);
  const activeCount = products.filter((p) => p.status === ProductStatus.ACTIVE).length;
  const atCap = limit > 0 && activeCount >= limit;
  const capPct = limit > 0 ? Math.min(100, Math.round((activeCount / limit) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My products</h1>
        {tier >= 2 && !atCap && (
          <Link href="/seller/products/new" className="btn-primary">+ Add product</Link>
        )}
      </div>

      {/* Tier-cap card */}
      <div
        className={`card flex flex-wrap items-center gap-3 p-4 ${
          tier < 2 ? "border-amber-200 bg-amber-50/40" : ""
        }`}
      >
        <span
          className={
            tier === 3
              ? "badge bg-gold-50 text-gold-700"
              : tier === 2
              ? "badge bg-sky-50 text-sky-700"
              : "badge bg-ink-50 text-ink-600"
          }
        >
          Tier {tier}
        </span>
        <div className="min-w-0 flex-1">
          {tier === 1 ? (
            <p className="text-sm">
              You can&apos;t list products at Tier 1.{" "}
              <Link href="/seller/verification" className="font-semibold text-violet-700 hover:underline">
                Submit identity verification
              </Link>{" "}
              to unlock listings.
            </p>
          ) : (
            <>
              <p className="text-sm">
                <span className="font-semibold">{activeCount}</span> of{" "}
                <span className="font-semibold">{limit}</span> active listings used
                {atCap && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                    Cap reached
                  </span>
                )}
              </p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                <div
                  className={`h-full ${atCap ? "bg-amber-500" : "bg-violet-500"}`}
                  style={{ width: `${capPct}%` }}
                />
              </div>
              {tier === 2 && (
                <p className="mt-1 text-xs text-ink-500">
                  Upgrade to Tier 3 from your{" "}
                  <Link href="/seller/verification" className="font-medium text-violet-700 hover:underline">
                    verification dashboard
                  </Link>{" "}
                  to raise the cap to 100 and drop withdrawal fees to 1.5%.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {products.length === 0 ? (
        <div className="card p-10 text-center text-gray-500">
          No products yet. <Link href="/seller/products/new" className="text-brand-700 hover:underline">Create your first one</Link>.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const images = parseJsonArray(p.imagesJson);
            return (
              <div key={p.id} className="card overflow-hidden">
                <div className="aspect-square bg-gray-100">
                  {images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={images[0]} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-gray-400">no image</div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/seller/products/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    <ProductStatusToggle productId={p.id} initialStatus={p.status} />
                  </div>
                  <p className="mt-1 text-sm text-gray-600"><Price amount={p.price} /></p>
                  <p className="mt-2 text-xs text-gray-500">{timeAgo(p.createdAt)} · {p.likeCount} likes · {p.salesCount} sales</p>
                  <div className="mt-3 flex gap-2">
                    <Link href={`/seller/products/${p.id}`} className="btn-secondary text-xs">View</Link>
                    <Link href={`/seller/products/${p.id}/edit`} className="btn-secondary text-xs">Edit</Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
