import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseJsonArray } from "@/lib/utils";
import { Price } from "@/components/Price";
import { ShareButton } from "@/components/ShareButton";
import { TierBadge } from "@/components/TierBadge";
import { topTier } from "@/lib/tiers";
import { hasDirectPay } from "@/lib/directPay";

// A seller's own storefront — the link they share (/shop/<handle>).
//
// Opening it locks the visitor to this seller (see src/middleware.ts): the
// header shows only this shop, the rest of the marketplace is closed off, and
// the only things for sale are this seller's products.

export const dynamic = "force-dynamic";

const SELLER_SELECT = {
  id: true,
  slug: true,
  name: true,
  businessName: true,
  bio: true,
  avatarUrl: true,
  coverImageUrl: true,
  city: true,
  region: true,
  sellerTier: true,
  designerTier: true,
  sellerRatingAvg: true,
  sellerRatingCount: true,
  directPayEnabled: true,
  directBankCode: true,
  directAccountNumber: true,
  directAccountName: true,
} as const;

async function resolveSeller(handle: string) {
  return prisma.user.findFirst({
    where: { OR: [{ slug: handle }, { id: handle }], isSeller: true, suspendedAt: null },
    select: SELLER_SELECT,
  });
}

export async function generateMetadata({ params }: { params: { handle: string } }): Promise<Metadata> {
  const s = await resolveSeller(params.handle);
  if (!s) return { title: "StreekMart" };
  const name = s.businessName?.trim() || s.name;
  return {
    title: `${name} · Shop`,
    description: s.bio ?? `Shop ${name}'s collection.`,
    openGraph: {
      title: `${name} — shop`,
      description: s.bio ?? `Shop ${name}'s collection.`,
      images: s.coverImageUrl ?? s.avatarUrl ? [(s.coverImageUrl ?? s.avatarUrl)!] : undefined,
    },
  };
}

const SORTS = {
  new: { label: "Newest", orderBy: { createdAt: "desc" as const } },
  popular: { label: "Popular", orderBy: { likeCount: "desc" as const } },
  low: { label: "Price: low to high", orderBy: { price: "asc" as const } },
  high: { label: "Price: high to low", orderBy: { price: "desc" as const } },
};

export default async function StorefrontPage({
  params,
  searchParams,
}: {
  params: { handle: string };
  searchParams: { category?: string; sort?: string };
}) {
  const seller = await resolveSeller(params.handle);
  // Unknown or suspended seller: clear the lock so the visitor isn't stuck
  // on a dead link, and send them to the marketplace.
  if (!seller) redirect("/api/store/clear?next=/");

  const viewer = await getCurrentUser();
  const handle = seller.slug ?? seller.id;
  // Keep the canonical handle in the URL (and in the lock cookie, via the
  // middleware on the redirected request).
  if (params.handle !== handle) redirect(`/shop/${handle}`);

  const displayName = seller.businessName?.trim() || seller.name;
  const tier = topTier({ sellerTier: seller.sellerTier, designerTier: seller.designerTier });
  const direct = hasDirectPay(seller);
  const sortKey = (searchParams.sort && searchParams.sort in SORTS ? searchParams.sort : "new") as keyof typeof SORTS;

  const all = await prisma.product.findMany({
    where: { sellerId: seller.id, status: ProductStatus.ACTIVE },
    select: { category: true },
  });
  const categories = Array.from(new Set(all.map((p) => p.category))).sort();
  const category = searchParams.category && categories.includes(searchParams.category) ? searchParams.category : null;

  const products = await prisma.product.findMany({
    where: { sellerId: seller.id, status: ProductStatus.ACTIVE, ...(category ? { category } : {}) },
    orderBy: SORTS[sortKey].orderBy,
    take: 120,
  });

  const qs = (over: { category?: string | null; sort?: string }) => {
    const p = new URLSearchParams();
    const c = over.category === undefined ? category : over.category;
    if (c) p.set("category", c);
    const s = over.sort ?? sortKey;
    if (s !== "new") p.set("sort", s);
    const str = p.toString();
    return `/shop/${handle}${str ? `?${str}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <header className="card overflow-hidden">
        <div className="relative h-40 w-full sm:h-52">
          {seller.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={seller.coverImageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-g-aurora" />
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 px-4 pb-4 sm:px-5 sm:pb-5">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 border-white bg-white shadow-soft sm:h-20 sm:w-20">
              {seller.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={seller.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-600 to-fuchsia-500 text-xl font-bold text-white">
                  {displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="flex flex-wrap items-center gap-2 font-display text-lg font-semibold leading-tight text-white drop-shadow sm:text-2xl">
                <span className="truncate">{displayName}</span>
                <TierBadge tier={tier} variant="pill" />
              </h1>
              {seller.sellerRatingCount > 0 && (
                <p className="mt-1 text-[11px] font-medium text-white/90 drop-shadow">
                  <span aria-hidden="true">★</span> {seller.sellerRatingAvg.toFixed(1)}{" "}
                  <span className="opacity-80">
                    ({seller.sellerRatingCount} review{seller.sellerRatingCount === 1 ? "" : "s"})
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-3 px-5 py-4">
          {seller.bio && <p className="text-sm text-ink-600">{seller.bio}</p>}
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-600">
            {seller.city && <span className="badge bg-ink-50 text-ink-700">{[seller.city, seller.region].filter(Boolean).join(", ")}</span>}
            {direct && <span className="badge bg-emerald-50 text-emerald-700">Delivered by the seller</span>}
            <span>{products.length} item{products.length === 1 ? "" : "s"}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <ShareButton path={`/shop/${handle}`} title={`${displayName} on StreekMart`} text={seller.bio ?? `Shop ${displayName}`} />
            {viewer && viewer.id !== seller.id && (
              <Link href={`/messages?with=${seller.id}`} className="btn-secondary text-sm">
                Message
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Link
            href={qs({ category: null })}
            className={`rounded-full border px-3 py-1.5 text-sm ${!category ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white text-ink-700"}`}
          >
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c}
              href={qs({ category: c })}
              className={`rounded-full border px-3 py-1.5 text-sm ${category === c ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white text-ink-700"}`}
            >
              {c}
            </Link>
          ))}
        </div>
        <div className="flex gap-2 text-sm">
          {(Object.keys(SORTS) as Array<keyof typeof SORTS>).map((k) => (
            <Link
              key={k}
              href={qs({ sort: k })}
              className={k === sortKey ? "font-semibold text-ink-900 underline" : "text-ink-500 hover:text-ink-800"}
            >
              {SORTS[k].label}
            </Link>
          ))}
        </div>
      </div>

      {products.length === 0 ? (
        <div className="card p-10 text-center text-ink-500">Nothing here right now. Check back soon.</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((p) => {
            const img = parseJsonArray(p.imagesJson)[0];
            const eff = p.salePrice ?? p.price;
            const onSale = p.salePrice != null && p.salePrice < p.price;
            return (
              <Link key={p.id} href={`/products/${p.id}`} className="product-card">
                <div className="relative aspect-[4/5] bg-ink-50">
                  {img && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={p.name} className="h-full w-full object-cover" />
                  )}
                  {p.stock <= 0 && (
                    <span className="absolute left-2 top-2 rounded-full bg-ink-900 px-2 py-0.5 text-[11px] font-semibold text-white">Sold out</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="line-clamp-1 text-sm font-medium">{p.name}</p>
                  <p className="text-sm font-semibold">
                    <Price amount={eff} />
                    {onSale && <span className="ml-2 text-xs font-normal text-ink-400 line-through"><Price amount={p.price} /></span>}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
