import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORY_GROUPS, ProductKind, ProductStatus } from "@/lib/enums";
import { rankScore } from "@/lib/ranking";
import { parseJsonArray } from "@/lib/utils";
import { ProductCard, type ProductCardData } from "@/components/storefront/ProductCard";
import { CategoryRail } from "@/components/storefront/CategoryRail";
import { LocationFilter } from "@/components/storefront/LocationFilter";
import { SmartSuggestions } from "@/components/SmartSuggestions";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { country?: string; city?: string };
}) {
  const user = await getCurrentUser();
  const now = new Date();

  // Optional URL-based location filter — applied to every product rail.
  // Country is matched exactly (ISO-2). City is matched case-insensitively
  // via Prisma's `equals` after trimming.
  const country = searchParams.country?.toUpperCase().slice(0, 2);
  const city = searchParams.city?.trim();
  const sellerWhere: Record<string, unknown> = {};
  if (country) sellerWhere.country = country;
  if (city) sellerWhere.city = { equals: city };
  const productWhere = {
    status: ProductStatus.ACTIVE,
    ...(Object.keys(sellerWhere).length > 0 ? { seller: sellerWhere } : {}),
  };

  const [products, designers, savedFavorites, perCategoryGrouped] = await Promise.all([
    prisma.product.findMany({
      where: productWhere,
      include: {
        seller: { select: { id: true, name: true, exposureScore: true, sellerVerified: true } },
        promotions: { where: { active: true, endsAt: { gt: now } } },
      },
      take: 200,
    }),
    prisma.user.findMany({
      where: { isDesigner: true },
      orderBy: { exposureScore: "desc" },
      take: 8,
      select: { id: true, name: true, bio: true, exposureScore: true, designerVerified: true },
    }),
    user
      ? prisma.favorite.findMany({
          where: { userId: user.id, productId: { not: null } },
          select: { productId: true },
        })
      : Promise.resolve([]),
    prisma.product.groupBy({
      by: ["category"],
      where: productWhere,
      _count: { _all: true },
    }),
  ]);

  const savedSet = new Set(savedFavorites.map((f) => f.productId!));
  const categoryCounts = new Map(perCategoryGrouped.map((c) => [c.category, c._count._all]));

  function shape(p: typeof products[number]): ProductCardData {
    return {
      id: p.id,
      name: p.name,
      price: p.price,
      salePrice: p.salePrice,
      category: p.category,
      image: parseJsonArray(p.imagesJson)[0] ?? null,
      sellerName: p.seller.name,
      sellerVerified: p.seller.sellerVerified,
      promoted: p.promotions.length > 0,
      rating: p.ratingAvg,
      ratingCount: p.ratingCount,
    };
  }

  const ranked = [...products]
    .sort(
      (a, b) =>
        rankScore({
          createdAt: b.createdAt,
          viewCount: b.viewCount,
          likeCount: b.likeCount,
          saveCount: b.saveCount,
          salesCount: b.salesCount,
          ownerExposureScore: b.seller.exposureScore,
          promotionBoost: b.promotions[0]?.boost ?? 1,
        }) -
        rankScore({
          createdAt: a.createdAt,
          viewCount: a.viewCount,
          likeCount: a.likeCount,
          saveCount: a.saveCount,
          salesCount: a.salesCount,
          ownerExposureScore: a.seller.exposureScore,
          promotionBoost: a.promotions[0]?.boost ?? 1,
        }),
    );

  const featured = ranked.slice(0, 8);
  const trendingFabrics = products
    .filter((p) => p.kind === ProductKind.MATERIAL)
    .sort((a, b) => b.likeCount - a.likeCount)
    .slice(0, 6);
  const flashSales = products
    .filter((p) => p.salePrice !== null && p.salePrice < p.price)
    .sort((a, b) => (b.price - (b.salePrice ?? b.price)) - (a.price - (a.salePrice ?? a.price)))
    .slice(0, 6);
  const newArrivals = [...products]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 6);
  const bestSellers = [...products]
    .sort((a, b) => b.salesCount - a.salesCount)
    .slice(0, 6);

  return (
    <div className="space-y-10 pb-12 sm:space-y-12">
      {/*
        Top row: dense category rail (lg+) | compact hero.
        Hero is intentionally bounded (~h-[420px] on desktop) so the first
        product rail peeks above the fold instead of being pushed below.
      */}
      {/* Desktop-only location filter strip — mobile gets it inside the
          collapsible Shop-by-category section below. */}
      <div className="hidden lg:block">
        <LocationFilter />
      </div>

      <section className="grid gap-4 lg:grid-cols-[14rem_1fr]">
        <CategoryRail counts={categoryCounts} />

        <div className="relative h-[300px] overflow-hidden rounded-2xl bg-g-aurora text-white shadow-soft sm:h-[360px] lg:h-[420px]">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold-300/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-0 h-56 w-56 rounded-full bg-fuchsia-400/30 blur-3xl" />

          <div className="relative grid h-full gap-6 px-6 py-7 sm:gap-8 sm:px-8 sm:py-9 md:grid-cols-[1.5fr_1fr] md:items-center lg:gap-10 lg:px-10">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-gold-200 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-gold-300" />
                Fashion marketplace
              </span>
              <h1 className="mt-3 font-display text-3xl font-bold leading-[0.95] sm:text-4xl lg:text-5xl">
                From the <span className="italic text-gold-200">loom</span>
                <br />
                to the <span className="italic text-gold-200">look.</span>
              </h1>
              <p className="mt-3 max-w-md text-sm text-white/85 sm:text-[15px]">
                Fabrics, ready-to-wear, and accessories from independent sellers and designers.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/feed"
                  className="btn-gold inline-flex shrink-0 whitespace-nowrap px-3 py-1.5 text-xs sm:text-sm"
                >
                  Explore designers
                </Link>
                <Link
                  href="/search"
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-white/30 bg-white/10 px-3 py-1.5 text-xs text-white backdrop-blur hover:bg-white/20 sm:text-sm"
                >
                  ✨ Smart search
                </Link>
              </div>
            </div>

            <div className="hidden grid-cols-2 gap-3 md:grid">
              {featured.slice(0, 4).map((p, i) => {
                const img = parseJsonArray(p.imagesJson)[0];
                return (
                  <Link
                    key={p.id}
                    href={`/products/${p.id}`}
                    className={`aspect-square overflow-hidden rounded-xl bg-violet-900/40 ring-1 ring-white/10 ${
                      i % 2 === 1 ? "translate-y-4" : ""
                    }`}
                  >
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt={p.name}
                        className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/*
        Mobile/tablet category chips — hidden on lg+ since the sidebar
        replaces them. Wrapped in a native <details> so the section starts
        collapsed on phones (where it'd otherwise burn ~half a screen of
        vertical room) but stays a single tap away. Open by default on sm+.
      */}
      <details className="group lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-ink-100 bg-white px-4 py-3 transition-colors hover:border-violet-400">
          <h2 className="font-display text-base font-semibold sm:text-lg">Shop by category & location</h2>
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0 text-ink-500 transition-transform group-open:rotate-180"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </summary>
        <div className="mt-3 space-y-3">
          {/* Location filter — writes to ?country & ?city so every rail re-queries. */}
          <div className="rounded-xl border border-ink-100 bg-white p-3">
            <LocationFilter />
          </div>
          {(Object.entries(CATEGORY_GROUPS) as ReadonlyArray<readonly [string, readonly string[]]>).map(([group, items]) => (
            <div key={group}>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-ink-500">{group}</p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((c) => (
                  <Link
                    key={c}
                    href={`/feed?category=${encodeURIComponent(c)}`}
                    className="chip"
                  >
                    {c}
                    <span className="ml-1.5 text-[11px] text-ink-400">{categoryCounts.get(c) ?? 0}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>

      {/* Flash sales */}
      {flashSales.length > 0 && (
        <Section title="🔥 Flash sales" subtitle="Limited-time discounts from sellers — grab before they're gone." href="/feed">
          <CardGrid items={flashSales.map(shape)} savedSet={savedSet} cols={6} />
        </Section>
      )}

      {/* Trending fabrics */}
      {trendingFabrics.length > 0 && (
        <Section title="Trending fabrics" subtitle="Yardage and rolls from independent sellers." href="/feed?category=Linen">
          <CardGrid items={trendingFabrics.map(shape)} savedSet={savedSet} cols={6} />
        </Section>
      )}

      {/* Featured (ranked) */}
      <Section title="Featured pieces" subtitle="Ranked by engagement, sales, and active promotions." href="/feed">
        <CardGrid items={featured.map(shape)} savedSet={savedSet} cols={4} />
      </Section>

      {/* New arrivals */}
      <Section title="New arrivals" subtitle="Fresh listings, just in." href="/feed">
        <CardGrid items={newArrivals.map(shape)} savedSet={savedSet} cols={6} />
      </Section>

      {/* Best sellers */}
      {bestSellers.length > 0 && bestSellers.some((p) => p.salesCount > 0) && (
        <Section title="Best sellers" subtitle="What buyers keep coming back for." href="/feed">
          <CardGrid items={bestSellers.map(shape)} savedSet={savedSet} cols={6} />
        </Section>
      )}

      {/* Smart suggestions — personalised for signed-in users, trending for guests. */}
      <SmartSuggestions />

      {/* Top designers */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold sm:text-xl">Top designers</h2>
            <p className="text-xs text-ink-500">Independent designers ranked by exposure on StreekMart.</p>
          </div>
          <Link
            href="/feed"
            className="shrink-0 whitespace-nowrap text-xs text-gold-700 hover:underline sm:text-sm"
          >
            Browse →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {designers.map((d) => (
            <Link key={d.id} href={`/messages?with=${d.id}`} className="card flex items-center gap-3 p-4 hover:border-gold-500">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-900 text-base font-bold text-gold-300">
                {d.name.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {d.name}
                  {d.designerVerified && <span className="ml-1 text-emerald-accent">✓</span>}
                </p>
                <p className="line-clamp-1 text-xs text-ink-500">{d.bio ?? "Independent designer"}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA — become a seller/designer */}
      <section className="relative overflow-hidden rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-10 text-center">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-fuchsia-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-violet-300/30 blur-3xl" />
        <div className="relative">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            Sell or design on <span className="h-italic-gold">StreekMart.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-ink-600 sm:text-base">
            Open your storefront in minutes. Sellers list materials and ready-to-wear; designers publish portfolio posts and use the Sketch Studio. AI tools help you write listings and posts.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            {user ? (
              <Link href="/account" className="btn-primary">Manage permissions</Link>
            ) : (
              <Link href="/register" className="btn-primary">Get started</Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Section({
  title,
  subtitle,
  href,
  children,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold sm:text-xl">{title}</h2>
          {subtitle && <p className="text-xs text-ink-500">{subtitle}</p>}
        </div>
        {href && (
          <Link
            href={href}
            className="shrink-0 whitespace-nowrap text-xs text-gold-700 hover:underline sm:text-sm"
          >
            See all →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function CardGrid({
  items,
  savedSet,
  cols,
}: {
  items: ProductCardData[];
  savedSet: Set<string>;
  cols: 4 | 6;
}) {
  // Full-width layout means we want a lot more columns on ultra-wide screens.
  // 2 → 6 (xl) for the dense rails, 2 → 5 (xl) for the feature grid.
  const colsClass =
    cols === 6
      ? "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 3xl:grid-cols-7"
      : "grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5";
  return (
    <div className={colsClass}>
      {items.map((p) => (
        <ProductCard key={p.id} p={p} saved={savedSet.has(p.id)} />
      ))}
    </div>
  );
}
