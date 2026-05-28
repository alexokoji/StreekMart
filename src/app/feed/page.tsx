import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORIES } from "@/lib/enums";
import { rankScore } from "@/lib/ranking";
import { isAiEnabled } from "@/lib/ai";
import { parseJsonArray, timeAgo } from "@/lib/utils";
import { PostCard } from "@/components/feed/PostCard";
import { ForYouRow } from "@/components/ForYouRow";
import { LocationFilter } from "@/components/storefront/LocationFilter";

// Designer-content feed (Facebook-style: left nav, main timeline, right rail).
// Shopping happens on the storefront homepage; this page is for inspiration.

export default async function FeedPage({
  searchParams,
}: {
  searchParams: { category?: string; country?: string; city?: string };
}) {
  const user = await getCurrentUser();
  const now = new Date();
  const category = searchParams.category && CATEGORIES.includes(searchParams.category)
    ? searchParams.category
    : null;

  // Location filter — scopes posts to authors in the selected country/city.
  // Matches the homepage UX.
  const country = searchParams.country?.toUpperCase().slice(0, 2);
  const city = searchParams.city?.trim();
  const authorWhere: Record<string, unknown> = {};
  if (country) authorWhere.country = country;
  if (city) authorWhere.city = { equals: city };
  const postWhere = Object.keys(authorWhere).length > 0 ? { author: authorWhere } : undefined;

  // category filter is for browsing the storefront; the feed itself ignores it
  // (no per-category designer posts). We still surface it in the chip rail
  // so users can switch back to product browsing easily.

  const [posts, topDesigners, savedPostIds, followedDesignerIds] = await Promise.all([
    prisma.post.findMany({
      where: postWhere,
      include: {
        author: { select: { id: true, name: true, exposureScore: true, designerVerified: true, designerTier: true, bio: true } },
        promotions: { where: { active: true, endsAt: { gt: now } } },
        _count: { select: { comments: true, likes: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.user.findMany({
      // Feed rail and home rail share the same rule now: only verified
      // designers (Tier 2+) appear in the "Top designers" surfaces.
      where: { isDesigner: true, designerTier: { gte: 2 } },
      orderBy: { exposureScore: "desc" },
      take: 6,
      select: { id: true, name: true, bio: true, designerVerified: true, designerTier: true },
    }),
    user
      ? prisma.favorite.findMany({
          where: { userId: user.id, postId: { not: null } },
          select: { postId: true },
        })
      : Promise.resolve([]),
    user
      ? prisma.follow.findMany({
          where: { followerId: user.id },
          select: { designerId: true },
        })
      : Promise.resolve([]),
  ]);

  const savedSet = new Set(savedPostIds.map((f) => f.postId!));
  const followedSet = new Set(followedDesignerIds.map((f) => f.designerId));

  // Posting cadence — count each author's posts in the last 30 days so the
  // ranker can give consistent posters a small visibility tail-wind.
  const sinceCadence = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const cadenceRows = await prisma.post.groupBy({
    by: ["authorId"],
    where: { createdAt: { gte: sinceCadence }, authorId: { in: posts.map((p) => p.authorId) } },
    _count: { _all: true },
  });
  const cadenceMap = new Map(cadenceRows.map((r) => [r.authorId, r._count._all]));

  // Score with viewer follow + cadence + verified weighting.
  const scoreFor = (p: (typeof posts)[number]) =>
    rankScore({
      createdAt: p.createdAt,
      viewCount: p.viewCount,
      likeCount: p.likeCount,
      saveCount: p.saveCount,
      ownerExposureScore: p.author.exposureScore,
      promotionBoost: p.promotions[0]?.boost ?? 1,
      viewerFollows: followedSet.has(p.authorId),
      authorPostsLast30: cadenceMap.get(p.authorId) ?? 0,
      verified: p.author.designerVerified,
    });
  const ranked = [...posts].sort((a, b) => scoreFor(b) - scoreFor(a));

  // Shared rail content — re-rendered inline on lg+ and wrapped in a
  // <details> collapsible on smaller screens so the timeline isn't pushed
  // half a screen down on mobile.
  const railContent = (
    <div className="space-y-4">
      <div className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Browse</p>
        <nav className="mt-2 flex flex-col gap-1 text-sm">
          <Link href="/feed" className="rounded-md px-2 py-1.5 hover:bg-ink-50">All posts</Link>
          <Link href="/" className="rounded-md px-2 py-1.5 hover:bg-ink-50">Storefront</Link>
          <Link href="/wishlist" className="rounded-md px-2 py-1.5 hover:bg-ink-50">Wishlist</Link>
          {user?.isDesigner && (
            <Link href="/designer/posts/new" className="rounded-md px-2 py-1.5 text-gold-700 hover:bg-gold-50">+ New post</Link>
          )}
        </nav>
      </div>

      <div className="card p-4">
        <LocationFilter />
      </div>

      <div className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Categories</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CATEGORIES.slice(0, 12).map((c) => (
            <Link
              key={c}
              href={`/feed?category=${encodeURIComponent(c)}`}
              className={category === c ? "chip-active" : "chip"}
            >
              {c}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)_18rem]">
      {/* Mobile/tablet — collapsible filter drawer above the timeline. */}
      <details className="group lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-ink-100 bg-white px-4 py-3 hover:border-violet-400">
          <span className="font-display text-base font-semibold">Filters & navigation</span>
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
        <div className="mt-3">{railContent}</div>
      </details>

      {/* Desktop left rail — sticky inline column. */}
      <aside className="hidden lg:block lg:sticky lg:top-4 lg:self-start">
        {railContent}
      </aside>

      {/* Main timeline */}
      <div className="space-y-4">
        <div className="card p-4">
          <h1 className="font-display text-xl font-semibold">Designer feed</h1>
          <p className="text-xs text-ink-500">
            Inspiration, mood boards, finished work, and process notes from independent designers.
          </p>
        </div>

        {user && isAiEnabled() && !category && <ForYouRow />}

        {ranked.length === 0 ? (
          <div className="card p-10 text-center text-ink-500">
            No posts yet. {user?.isDesigner ? (
              <Link href="/designer/posts/new" className="text-gold-700 hover:underline">Be the first to post</Link>
            ) : "Check back soon."}
          </div>
        ) : (
          <div className="space-y-4">
            {ranked.map((p) => (
              <PostCard
                key={p.id}
                post={{
                  id: p.id,
                  title: p.title,
                  body: p.body,
                  images: parseJsonArray(p.imagesJson),
                  tags: parseJsonArray(p.tagsJson),
                  createdAt: p.createdAt.toISOString(),
                  likeCount: p.likeCount,
                  commentCount: p._count.comments,
                  promoted: p.promotions.length > 0,
                  author: {
                    id: p.author.id,
                    name: p.author.name,
                    bio: p.author.bio,
                    designerVerified: p.author.designerVerified,
                  },
                }}
                authed={!!user}
                initialSaved={savedSet.has(p.id)}
                initialFollowing={followedSet.has(p.author.id)}
                isOwn={!!user && user.id === p.author.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right rail */}
      <aside className="hidden space-y-4 lg:block lg:sticky lg:top-4 lg:self-start">
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Top designers</p>
          <ul className="mt-3 space-y-3">
            {topDesigners.map((d) => (
              <li key={d.id} className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-900 text-sm font-bold text-gold-300">
                  {d.name.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium">
                    {d.name}
                    {d.designerVerified && <span className="ml-1 text-emerald-accent">✓</span>}
                  </p>
                  <p className="line-clamp-1 text-xs text-ink-500">{d.bio ?? "Independent designer"}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-4 text-xs text-ink-500">
          <p className="font-semibold text-ink-700">About the feed</p>
          <p className="mt-1">
            Only designers can publish posts. Anyone can like, save, comment, and follow.
          </p>
        </div>

        {user && (
          <div className="card p-4 text-xs">
            <p className="font-semibold text-ink-700">Recently posted</p>
            <ul className="mt-2 space-y-1.5">
              {posts.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <Link href={`/posts/${p.id}`} className="line-clamp-1 text-ink-600 hover:text-gold-700">
                    {p.title} <span className="text-ink-400">· {timeAgo(p.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
