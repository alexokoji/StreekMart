import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { displaySellerName } from "@/lib/businessName";
import { parseJsonArray, timeAgo } from "@/lib/utils";
import { Price } from "@/components/Price";
import { AddToCartButton } from "@/components/AddToCartButton";
import { Band, PageCanvas, PageHead } from "@/components/storefront/Band";

export default async function WishlistPage() {
  const user = await requireUser();
  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id, productId: { not: null } },
    include: {
      product: { include: { seller: { select: { id: true, name: true, businessName: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <PageCanvas>
      <PageHead
        eyebrow="Saved"
        title="Your wishlist"
        subtitle="Saved products ready to move into your cart."
        backHref="/"
        backLabel="Back home"
        action={<Link href="/favorites" className="btn-secondary text-sm">Saved posts</Link>}
      />

      <Band tone="base">
      {favorites.length === 0 ? (
        <div className="card p-10 text-center text-gray-500">
          You haven&apos;t saved any products yet. Browse the <Link href="/" className="text-brand-700 hover:underline">storefront</Link> to start collecting.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((f) => {
            if (!f.product) return null;
            const images = parseJsonArray(f.product.imagesJson);
            const effective = f.product.salePrice ?? f.product.price;
            return (
              <article key={f.id} className="card overflow-hidden">
                <Link href={`/products/${f.product.id}`} className="block">
                  <div className="aspect-square bg-gray-100">
                    {images[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={images[0]} alt={f.product.name} className="h-full w-full object-cover" />
                    )}
                  </div>
                </Link>
                <div className="p-4">
                  <Link href={`/products/${f.product.id}`} className="font-medium hover:underline">
                    {f.product.name}
                  </Link>
                  <p className="mt-1 text-sm">
                    <span className="font-semibold"><Price amount={effective} /></span>
                    {f.product.salePrice !== null && (
                      <span className="ml-2 text-xs text-gray-400 line-through"><Price amount={f.product.price} /></span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">Saved {timeAgo(f.createdAt)} · By {displaySellerName(f.product.seller)}</p>
                  <div className="mt-3">
                    <AddToCartButton productId={f.product.id} disabled={f.product.sellerId === user.id} compact />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      </Band>
    </PageCanvas>
  );
}
