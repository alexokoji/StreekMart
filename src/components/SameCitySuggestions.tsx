import Link from "next/link";
import { ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { parseJsonArray } from "@/lib/utils";
import { Price } from "@/components/Price";

// Server component — renders a "Find this in your city" rail when the
// viewing buyer is in a different country (international) OR a different
// city from the seller. Pulls up to 6 same-city alternatives in the same
// category. Hidden entirely when there's no city mismatch or no buyer
// location data to compare against.
export async function SameCitySuggestions({
  buyer,
  product,
}: {
  buyer: { country: string | null; city: string | null } | null;
  product: {
    id: string;
    category: string;
    seller: { country: string | null; city: string | null };
  };
}) {
  if (!buyer?.country || !buyer.city) return null;

  const sellerCountry = product.seller.country;
  const sellerCity = product.seller.city;
  const sameCountry = sellerCountry && sellerCountry === buyer.country;
  const sameCity =
    sameCountry && sellerCity && buyer.city &&
    sellerCity.trim().toLowerCase() === buyer.city.trim().toLowerCase();

  if (sameCity) return null;

  const candidates = await prisma.product.findMany({
    where: {
      id: { not: product.id },
      status: ProductStatus.ACTIVE,
      category: product.category,
      seller: {
        country: buyer.country,
        city: { equals: buyer.city },
        OR: [{ sellerVerified: true }, { designerVerified: true }],
      },
    },
    include: {
      seller: { select: { id: true, name: true, slug: true, sellerVerified: true } },
    },
    orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
    take: 6,
  });

  if (candidates.length === 0) {
    // No local alternatives — at least tell the buyer they're shopping cross-
    // city / cross-country so they're not surprised at checkout.
    return (
      <section className="card border-amber-200 bg-amber-50/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
          {sameCountry ? "Outside your city" : "International seller"}
        </p>
        <p className="mt-1 text-sm">
          {sameCountry
            ? `This seller is in ${sellerCity ?? "another city"} — they'll need their own rider to deliver.`
            : "International orders aren't supported yet — you won't be able to check out from this seller."}
        </p>
      </section>
    );
  }

  return (
    <section className="card p-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-700">
            Closer to you
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold">
            Similar items in {buyer.city}
          </h2>
        </div>
        <Link
          href={`/?category=${encodeURIComponent(product.category)}`}
          className="text-xs text-violet-700 hover:underline"
        >
          See more →
        </Link>
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {candidates.map((p) => {
          const img = parseJsonArray(p.imagesJson)[0] ?? null;
          const handle = p.seller.slug ?? p.seller.id;
          return (
            <li key={p.id} className="overflow-hidden rounded-xl border border-ink-100 bg-white">
              <Link href={`/products/${p.id}`} className="block">
                <div className="aspect-square bg-ink-100">
                  {img && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={p.name} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="p-3">
                  <p className="line-clamp-1 text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-ink-500">
                    <Link href={`/u/${handle}`} className="hover:underline">
                      {p.seller.name}
                    </Link>
                    {p.seller.sellerVerified && <span className="ml-1 text-emerald-accent">✓</span>}
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    <Price amount={p.salePrice ?? p.price} />
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
