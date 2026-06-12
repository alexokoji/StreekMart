import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  ProductKind,
  ProductStatus,
  PromotionStatus,
} from "@/lib/enums";
import { readActiveCategoryNames, readCategoryGroups } from "@/lib/categories";
import { displaySellerName } from "@/lib/businessName";
import { rankScore } from "@/lib/ranking";
import { parseJsonArray } from "@/lib/utils";
import { type ProductCardData } from "@/components/storefront/ProductCard";
import { CardGrid } from "@/components/storefront/CardGrid";
import { CategoryRail } from "@/components/storefront/CategoryRail";
import { LocationFilter } from "@/components/storefront/LocationFilter";
import { PopularCategoryCards } from "@/components/storefront/PopularCategoryCards";
import { FlashSalesCarousel } from "@/components/storefront/FlashSalesCarousel";
import { CountdownTimer } from "@/components/CountdownTimer";
import { endOfTodayMs } from "@/lib/time";
import {
  PreorderDesignsRail,
  type PreorderDesignCard,
} from "@/components/storefront/PreorderDesignsRail";
import { TierBadge } from "@/components/TierBadge";
import {
  PromotionSlider,
  type PromotionSlide,
} from "@/components/storefront/PromotionSlider";
import { SmartSuggestions } from "@/components/SmartSuggestions";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { country?: string; city?: string; category?: string };
}) {
  const user = await getCurrentUser();
  const now = new Date();

  // Live admin-managed category list — drives both the CategoryRail's
  // group ordering and the activeCategory validation. Pulled once and
  // shared across the page so a single read covers every surface.
  const [categoryGroups, activeCategoryNames] = await Promise.all([
    readCategoryGroups(),
    readActiveCategoryNames(),
  ]);
  const activeCategorySet = new Set(activeCategoryNames);

  // Optional URL-based filters — applied to every product rail on the page
  // so a click on the CategoryRail or LocationFilter narrows the home page
  // in place rather than punting to the feed.
  const country = searchParams.country?.toUpperCase().slice(0, 2);
  const city = searchParams.city?.trim();
  const activeCategory =
    searchParams.category && activeCategorySet.has(searchParams.category)
      ? searchParams.category
      : null;
  const sellerWhere: Record<string, unknown> = {};
  if (country) sellerWhere.country = country;
  if (city) sellerWhere.city = { equals: city };
  const productWhere: Record<string, unknown> = {
    status: ProductStatus.ACTIVE,
    ...(Object.keys(sellerWhere).length > 0 ? { seller: sellerWhere } : {}),
    ...(activeCategory ? { category: activeCategory } : {}),
  };

  // "Frequently visited designers" — anyone the user has followed, saved a
  // post from, or liked a post from. Strongest available proxy without a
  // dedicated view-tracking table. Guests fall back to top designers below.
  const interactedDesignerIds = user
    ? await prisma.$transaction([
        prisma.follow.findMany({
          where: { followerId: user.id },
          select: { designerId: true },
          take: 50,
        }),
        prisma.favorite.findMany({
          where: { userId: user.id, postId: { not: null } },
          select: { post: { select: { authorId: true } } },
          take: 50,
        }),
        prisma.like.findMany({
          where: { userId: user.id, postId: { not: null } },
          select: { post: { select: { authorId: true } } },
          take: 50,
        }),
      ]).then(([follows, favs, likes]) => {
        const set = new Set<string>();
        follows.forEach((f) => set.add(f.designerId));
        favs.forEach((f) => f.post && set.add(f.post.authorId));
        likes.forEach((l) => l.post && set.add(l.post.authorId));
        return Array.from(set);
      })
    : [];

  const [products, designers, savedFavorites, perCategoryGrouped, activePromotions, preorderablePosts] = await Promise.all([
    prisma.product.findMany({
      where: productWhere,
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            // businessName takes precedence on every product surface — see
            // displaySellerName in @/lib/businessName.
            businessName: true,
            exposureScore: true,
            sellerVerified: true,
            sellerTier: true,
            sellerRatingAvg: true,
            sellerRatingCount: true,
          },
        },
        // Only APPROVED, currently-running promotions feed into rank-boost.
        // PENDING_REVIEW rows shouldn't influence ordering before an admin
        // signs off, and `active=true` alone isn't enough (legacy rows
        // could have skipped the new state machine).
        promotions: {
          where: {
            active: true,
            status: PromotionStatus.APPROVED,
            endsAt: { gt: now },
          },
        },
      },
      take: 200,
    }),
    prisma.user.findMany({
      // Home "Top designers" rail is curated — only Tier 2+ designers
      // appear so the section is a signal of quality, not a directory of
      // every account flagged isDesigner. Matches the feed rail's filter.
      where: { isDesigner: true, designerTier: { gte: 2 } },
      orderBy: { exposureScore: "desc" },
      take: 8,
      select: { id: true, slug: true, name: true, bio: true, exposureScore: true, designerVerified: true, designerTier: true },
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
    // Approved, currently-running product promotions. Sorted oldest-first
    // so promos that have been live longest cycle out as new ones come in,
    // giving every seller fair time at the top of the page.
    prisma.promotion.findMany({
      where: {
        status: PromotionStatus.APPROVED,
        active: true,
        endsAt: { gt: now },
        productId: { not: null },
        product: { status: ProductStatus.ACTIVE },
      },
      include: {
        product: {
          include: {
            seller: { select: { name: true, businessName: true } },
          },
        },
      },
      orderBy: { startsAt: "asc" },
      take: 10,
    }),
    // Preorderable designer posts. When the user has interacted with at
    // least one designer, restrict to that set so the rail feels personal;
    // otherwise pull from Tier 2+ designers ranked by exposure. Always
    // filter for posts with both numerics actually set — the boolean alone
    // isn't a guarantee since older rows could have nulled price/lead.
    prisma.post.findMany({
      where: {
        preorderEnabled: true,
        preorderPriceCents: { not: null },
        preorderLeadDays: { not: null },
        author: {
          isDesigner: true,
          ...(interactedDesignerIds.length > 0
            ? { id: { in: interactedDesignerIds } }
            : { designerTier: { gte: 2 } }),
        },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        title: true,
        imagesJson: true,
        preorderPriceCents: true,
        preorderLeadDays: true,
        author: { select: { id: true, name: true, slug: true } },
      },
    }),
  ]);

  const preorderDesignCards: PreorderDesignCard[] = preorderablePosts
    .filter((p) => p.preorderPriceCents != null && p.preorderLeadDays != null)
    .map((p) => ({
      postId: p.id,
      title: p.title,
      image: parseJsonArray(p.imagesJson)[0] ?? null,
      priceCents: p.preorderPriceCents!,
      leadDays: p.preorderLeadDays!,
      designerId: p.author.id,
      designerSlug: p.author.slug,
      designerName: p.author.name,
    }));

  const recentlyViewed = user ? await prisma.recentlyViewed.findMany({
    where: { userId: user.id },
    orderBy: { viewedAt: "desc" },
    take: 10,
    include: { product: { include: { seller: { select: { id: true, name: true, businessName: true } } } } },
  }).then((rows) => rows.filter((r) => r.product && r.product.status === "ACTIVE")) : [];

  const buyAgainRows = user ? await prisma.order.findMany({
    where: { buyerId: user.id, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    take: 30,
    include: { product: { include: { seller: { select: { id: true, name: true, businessName: true, exposureScore: true, sellerVerified: true, sellerTier: true, sellerRatingAvg: true, sellerRatingCount: true } } } } },
  }).then((rows) => {
    const seen = new Set();
    const out = [];
    for (const o of rows) {
      if (!o.product || seen.has(o.product.id) || o.product.status !== "ACTIVE") continue;
      seen.add(o.product.id);
      out.push(o.product);
      if (out.length >= 6) break;
    }
    return out;
  }) : [];

  const followedSellerIds = user ? (await prisma.follow.findMany({
    where: { followerId: user.id },
    select: { designerId: true },
    take: 50,
  })).map((f) => f.designerId) : [];
  const followingProducts = followedSellerIds.length > 0 ? await prisma.product.findMany({
    where: { sellerId: { in: followedSellerIds }, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { seller: { select: { id: true, name: true, businessName: true, exposureScore: true, sellerVerified: true, sellerTier: true, sellerRatingAvg: true, sellerRatingCount: true } } },
  }) : [];

  const savedSet = new Set(savedFavorites.map((f) => f.productId!));
  const categoryCounts = new Map(perCategoryGrouped.map((c) => [c.category, c._count._all]));

  // Drop any promotion whose product was deleted between query and render,
  // then shape what the slider actually needs.
  const promotionSlides: PromotionSlide[] = activePromotions
    .filter((p): p is typeof p & { product: NonNullable<typeof p.product> } => !!p.product)
    .map((p) => ({
      promotionId: p.id,
      productId: p.product.id,
      name: p.product.name,
      image: parseJsonArray(p.product.imagesJson)[0] ?? null,
      price: p.product.price,
      salePrice: p.product.salePrice,
      sellerName: displaySellerName(p.product.seller),
      category: p.product.category,
    }));

  function shape(p: typeof products[number]): ProductCardData {
    const allImages = parseJsonArray(p.imagesJson);
    const sellerTier = (p.seller as { sellerTier?: number | null }).sellerTier
      ?? (p.seller.sellerVerified ? 2 : 1);
    return {
      id: p.id,
      name: p.name,
      price: p.price,
      salePrice: p.salePrice,
      category: p.category,
      image: allImages[0] ?? null,
      images: allImages,
      sellerName: displaySellerName(p.seller),
      sellerTier,
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
          verified: (b.seller.sellerTier ?? 0) >= 2,
          sellerRatingAvg: b.seller.sellerRatingAvg,
          sellerRatingCount: b.seller.sellerRatingCount,
        }) -
        rankScore({
          createdAt: a.createdAt,
          viewCount: a.viewCount,
          likeCount: a.likeCount,
          saveCount: a.saveCount,
          salesCount: a.salesCount,
          ownerExposureScore: a.seller.exposureScore,
          promotionBoost: a.promotions[0]?.boost ?? 1,
          verified: (a.seller.sellerTier ?? 0) >= 2,
          sellerRatingAvg: a.seller.sellerRatingAvg,
          sellerRatingCount: a.seller.sellerRatingCount,
        }),
    );

  // Carries the home page's active filters onto the landing-page "See all"
  // links — clicking through a filtered home page lands on a filtered
  // landing page rather than resetting the scope.
  const seeAllParams = new URLSearchParams();
  if (activeCategory) seeAllParams.set("category", activeCategory);
  if (country) seeAllParams.set("country", country);
  if (city) seeAllParams.set("city", city);
  const seeAllQuery = seeAllParams.toString();
  const seeAllHref = (railPath: string) =>
    seeAllQuery ? `${railPath}?${seeAllQuery}` : railPath;

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
      {/* Paid promotions — sellers pay ₦500 for a 3-day admin-approved
          slot at the absolute top of the home page, above everything
          else. Hidden when no live promotion exists. */}
      {promotionSlides.length > 0 && <PromotionSlider slides={promotionSlides} />}

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
        <CategoryRail counts={categoryCounts} groups={categoryGroups} basePath="/" activeCategory={activeCategory} />

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

      {/* Popular category cards — visible on every viewport (not hidden in
          a collapsible). Tap a card to filter every rail below to that
          category in a single tap, no scroll-through required. */}
      <PopularCategoryCards
        activeCategory={activeCategory}
        categoryCounts={categoryCounts}
        preserveSearchParams={(() => {
          const sp = new URLSearchParams();
          if (country) sp.set("country", country);
          if (city) sp.set("city", city);
          return sp;
        })()}
      />

      {/*
        Long-tail categories + location filter — still useful for buyers who
        want a niche like "Velvet" or "Watches". Collapsed by default on
        mobile so the popular cards + flash sales own the above-the-fold.
      */}
      <details className="group lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-ink-100 bg-white px-4 py-3 transition-colors hover:border-violet-400">
          <h2 className="font-display text-base font-semibold sm:text-lg">More categories & location</h2>
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
          {Object.entries(categoryGroups).map(([group, items]) => (
            <div key={group}>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-ink-500">{group}</p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((c) => (
                  <Link
                    key={c}
                    href={`/?category=${encodeURIComponent(c)}`}
                    className={activeCategory === c ? "chip bg-violet-50 text-violet-700" : "chip"}
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

      {/* Flash sales — now a horizontal scroll carousel with smaller cards
          so more deals fit in the row + the next section stays close. */}
      {flashSales.length > 0 && (
        <Section
          title="🔥 Flash sales"
          subtitle={<span className="inline-flex items-center gap-2">Limited-time discounts <CountdownTimer target={new Date(endOfTodayMs())} label="ends in" /></span>}
          href={seeAllHref("/products/flash-sales")}
        >
          <FlashSalesCarousel
            items={flashSales.map(shape)}
            seeAllHref={seeAllHref("/products/flash-sales")}
          />
        </Section>
      )}

      {/* Recently viewed - signed-in users only, 6 items shown */}
      {recentlyViewed.length > 0 && (
        <Section title="Recently viewed" subtitle="Pick up where you left off." href={undefined}>
          <CardGrid
            items={recentlyViewed.slice(0, 6).map((r) => ({
              id: r.product!.id,
              name: r.product!.name,
              price: r.product!.price,
              salePrice: r.product!.salePrice,
              category: r.product!.category,
              image: parseJsonArray(r.product!.imagesJson)[0] ?? null,
              images: parseJsonArray(r.product!.imagesJson),
              sellerName: displaySellerName(r.product!.seller),
              sellerTier: r.product!.seller && (r.product!.seller as { sellerTier?: number }).sellerTier ? (r.product!.seller as { sellerTier?: number }).sellerTier! : 1,
              promoted: false,
              rating: r.product!.ratingAvg ?? 0,
              ratingCount: r.product!.ratingCount ?? 0,
            }))}
            savedSet={savedSet}
            cols={6}
          />
        </Section>
      )}

      {/* Trending fabrics */}
      {trendingFabrics.length > 0 && (
        <Section title="Trending fabrics" subtitle="Yardage and rolls from independent sellers." href={seeAllHref("/products/trending-fabrics")}>
          <CardGrid items={trendingFabrics.map(shape)} savedSet={savedSet} cols={6} />
        </Section>
      )}

      {/* Featured (ranked) */}
      <Section title="Featured pieces" subtitle="Ranked by engagement, sales, and active promotions." href={seeAllHref("/products/featured")}>
        <CardGrid items={featured.map(shape)} savedSet={savedSet} cols={4} />
      </Section>

      {/* New arrivals */}
      <Section title="New arrivals" subtitle="Fresh listings, just in." href={seeAllHref("/products/new-arrivals")}>
        <CardGrid items={newArrivals.map(shape)} savedSet={savedSet} cols={6} />
      </Section>

      {/* Best sellers */}
      {bestSellers.length > 0 && bestSellers.some((p) => p.salesCount > 0) && (
        <Section title="Best sellers" subtitle="What buyers keep coming back for." href={seeAllHref("/products/best-sellers")}>
          <CardGrid items={bestSellers.map(shape)} savedSet={savedSet} cols={6} />
        </Section>
      )}

      {/* Smart suggestions — personalised for signed-in users, trending for guests. */}
      <SmartSuggestions />

      {/* Preorder designs — surfaces preorderable posts from designers the
          user has engaged with (follow / save / like). Guests fall back to
          Tier 2+ designers ranked by exposure. */}
      {preorderDesignCards.length > 0 && (
        <PreorderDesignsRail
          subtitle={
            user && interactedDesignerIds.length > 0
              ? "Custom pieces from designers you've engaged with — request now, pay delivery once it's ready."
              : "Request a custom piece from one of our top designers — pay upfront, delivery comes after the make."
          }
          items={preorderDesignCards}
        />
      )}

      {buyAgainRows.length > 0 && (
        <Section title="Buy it again" subtitle="From your past orders." href={undefined}>
          <CardGrid
            items={buyAgainRows.map((p) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              salePrice: p.salePrice,
              category: p.category,
              image: parseJsonArray(p.imagesJson)[0] ?? null,
              images: parseJsonArray(p.imagesJson),
              sellerName: displaySellerName(p.seller),
              sellerTier: ((p.seller as { sellerTier?: number | null }).sellerTier ?? 1),
              promoted: false,
              rating: p.ratingAvg ?? 0,
              ratingCount: p.ratingCount ?? 0,
            }))}
            savedSet={savedSet}
            cols={6}
          />
        </Section>
      )}

      {followingProducts.length > 0 && (
        <Section title="From stores you follow" subtitle="Latest from sellers you follow." href={undefined}>
          <CardGrid
            items={followingProducts.map((p) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              salePrice: p.salePrice,
              category: p.category,
              image: parseJsonArray(p.imagesJson)[0] ?? null,
              images: parseJsonArray(p.imagesJson),
              sellerName: displaySellerName(p.seller),
              sellerTier: ((p.seller as { sellerTier?: number | null }).sellerTier ?? 1),
              promoted: false,
              rating: p.ratingAvg ?? 0,
              ratingCount: p.ratingCount ?? 0,
            }))}
            savedSet={savedSet}
            cols={6}
          />
        </Section>
      )}

      {/* Top designers — only renders when at least one verified designer exists. */}
      {designers.length > 0 && (
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
            <Link key={d.id} href={`/u/${d.slug ?? d.id}`} className="card flex items-center gap-3 p-4 hover:border-gold-500">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-900 text-base font-bold text-gold-300">
                {d.name.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {d.name}
                  <TierBadge
                    tier={d.designerTier ?? (d.designerVerified ? 2 : 1)}
                    className="ml-1"
                  />
                </p>
                <p className="line-clamp-1 text-xs text-ink-500">{d.bio ?? "Independent designer"}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
      )}

      {/* CTA — become a seller/designer. The mobile shell hides this whole
          block via [data-app-hide] because (a) the inner "Manage permissions"
          / "Get started" links are already reachable from the bottom-nav
          avatar inside the app, and (b) the "Download the app" buttons are
          obviously pointless once the user IS in the app. */}
      <section
        data-app-hide
        className="relative overflow-hidden rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-10 text-center"
      >
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

          {/* App download row. Three buttons:
              1. Direct APK — points at /streekmart.apk (host the EAS build
                 output there). The only one that's actually clickable at
                 launch — Play Store + App Store are gated behind submissions
                 in flight.
              2. Google Play — "Coming soon" while the listing is in review.
              3. App Store — "Coming soon" while the iOS build is in review.
              Coming-soon buttons render as disabled-looking pills that
              still acknowledge a tap with a tiny aria-hint, so users can
              tell something will happen later.
              Visible on every web viewport — phone visitors are the prime
              audience for the app download. Inside the StreekMart mobile
              app the entire CTA section is hidden via the [data-app-hide]
              attribute on the parent <section>. */}
          <div className="mt-10">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
              Or get the app
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href="/streekmart.apk"
                download
                className="inline-flex items-center gap-2.5 rounded-2xl bg-ink-900 px-5 py-3 text-left text-white shadow-sm transition hover:bg-ink-800"
              >
                <AndroidGlyph />
                <span className="flex flex-col leading-tight">
                  <span className="text-[10px] uppercase tracking-wider text-ink-300">Download</span>
                  <span className="text-sm font-semibold">Android APK</span>
                </span>
              </a>
              <span
                aria-disabled="true"
                title="Listing in review — launching soon"
                className="relative inline-flex items-center gap-2.5 rounded-2xl border border-ink-200 bg-white px-5 py-3 text-left text-ink-500 shadow-sm"
              >
                <GooglePlayGlyph />
                <span className="flex flex-col leading-tight">
                  <span className="text-[10px] uppercase tracking-wider text-ink-400">Coming soon</span>
                  <span className="text-sm font-semibold">Google Play</span>
                </span>
              </span>
              <span
                aria-disabled="true"
                title="Listing in review — launching soon"
                className="relative inline-flex items-center gap-2.5 rounded-2xl border border-ink-200 bg-white px-5 py-3 text-left text-ink-500 shadow-sm"
              >
                <AppStoreGlyph />
                <span className="flex flex-col leading-tight">
                  <span className="text-[10px] uppercase tracking-wider text-ink-400">Coming soon</span>
                  <span className="text-sm font-semibold">App Store</span>
                </span>
              </span>
            </div>
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
  subtitle?: React.ReactNode;
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

// App-store glyphs used in the homepage CTA. Inline so we don't pull in an
// icon library for three logos used in one place. Drawn at 24x24 in a 1.6
// stroke / filled style that matches the rest of the storefront chrome.
function AndroidGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-emerald-400" fill="currentColor">
      <path d="M17.5 9.4l1.4-2.4a.4.4 0 10-.7-.4l-1.4 2.4A8 8 0 0012 8c-1.7 0-3.3.5-4.8 1l-1.4-2.4a.4.4 0 10-.7.4l1.4 2.4A6.9 6.9 0 003.5 15h17a6.9 6.9 0 00-3-5.6zM8 13a.9.9 0 110-1.8.9.9 0 010 1.8zm8 0a.9.9 0 110-1.8.9.9 0 010 1.8z" />
    </svg>
  );
}

function GooglePlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <defs>
        <linearGradient id="gp-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <path d="M4 3.2v17.6c0 .6.6 1 1.2.7l13.5-8.8a.9.9 0 000-1.5L5.2 2.5C4.6 2.1 4 2.5 4 3.2z" fill="url(#gp-a)" opacity="0.85" />
    </svg>
  );
}

function AppStoreGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-ink-700" fill="currentColor">
      <path d="M16.4 12.6c0-2.4 2-3.5 2-3.5a4 4 0 00-3.2-1.7c-1.4 0-2.7.8-3.4.8-.7 0-1.8-.8-3-.8a4.2 4.2 0 00-3.6 2.2c-1.5 2.7-.4 6.6 1.1 8.8.7 1 1.6 2.2 2.8 2.2 1.1 0 1.5-.7 2.8-.7s1.7.7 2.8.7c1.2 0 2-1.1 2.7-2.2.9-1.3 1.3-2.5 1.3-2.6-.1 0-2.3-.9-2.3-3.2zM14.1 5.3a3.5 3.5 0 00.9-2.6 3.6 3.6 0 00-2.4 1.2 3.4 3.4 0 00-.9 2.5c1 .1 1.9-.4 2.4-1.1z" />
    </svg>
  );
}

