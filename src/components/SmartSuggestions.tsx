import Link from "next/link";
import { ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { displaySellerName } from "@/lib/businessName";
import { parseJsonArray } from "@/lib/utils";
import { Price } from "@/components/Price";

// Server component that powers the homepage "Picked for you" rail.
//
// Anonymous: shows the platform's strongest verified-seller items by likes
//            + sales. Headline reads "Trending".
// Signed-in : if the user has stated interests, narrows to those categories;
//            otherwise blends in their recent likes via the same query.
//            Headline reads "Picked for you, <name>".
export async function SmartSuggestions() {
  const user = await getCurrentUser();

  // Stated preferences — only meaningful when signed in.
  let interests: string[] = [];
  if (user) {
    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { interestsJson: true },
    });
    interests = parseJsonArray(me?.interestsJson ?? "[]");
  }

  // Pull a wider pool than we render so we can dedupe + interleave below.
  const products = await prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      seller: { OR: [{ sellerVerified: true }, { designerVerified: true }] },
      ...(interests.length > 0 ? { category: { in: interests } } : {}),
    },
    include: {
      seller: { select: { id: true, name: true, businessName: true, slug: true, sellerVerified: true } },
    },
    orderBy: [{ likeCount: "desc" }, { salesCount: "desc" }, { createdAt: "desc" }],
    take: 12,
  });

  // Fallback when preference filter starved the pool.
  let picks = products;
  if (picks.length < 6) {
    const ids = new Set(picks.map((p) => p.id));
    const broader = await prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        seller: { OR: [{ sellerVerified: true }, { designerVerified: true }] },
      },
      include: {
        seller: { select: { id: true, name: true, businessName: true, slug: true, sellerVerified: true } },
      },
      orderBy: [{ likeCount: "desc" }, { salesCount: "desc" }, { createdAt: "desc" }],
      take: 12,
    });
    for (const p of broader) {
      if (ids.has(p.id)) continue;
      picks.push(p);
      ids.add(p.id);
      if (picks.length >= 12) break;
    }
  }

  if (picks.length === 0) return null;

  const personalised = !!user && interests.length > 0;

  return (
    <section className="card p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-700">
            {personalised ? "Picked for you" : "Trending now"}
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold">
            {personalised
              ? `Tuned to your interests, ${user?.name?.split(" ")[0] ?? "friend"}`
              : "What buyers are loving today"}
          </h2>
          {personalised && (
            <p className="text-xs text-ink-500">
              Based on {interests.slice(0, 3).join(", ")}
              {interests.length > 3 && ` +${interests.length - 3} more`}.
            </p>
          )}
        </div>
        <Link href="/search" className="text-xs text-violet-700 hover:underline">
          Smart search →
        </Link>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {picks.slice(0, 8).map((p) => {
          const img = parseJsonArray(p.imagesJson)[0] ?? null;
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
                  {/* Plain text, not a nested <Link> — an <a> inside the
                      card's wrapping <Link> is invalid HTML and breaks
                      hydration. The whole card already routes to the
                      product; the seller name is informational only here. */}
                  <p className="text-[11px] text-ink-500">
                    {displaySellerName(p.seller)}
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

      {!user && (
        <p className="mt-4 text-center text-xs text-ink-500">
          <Link href="/register" className="text-violet-700 hover:underline">
            Sign up
          </Link>{" "}
          and tell us what you love — we&apos;ll tune this rail to your taste.
        </p>
      )}
    </section>
  );
}
