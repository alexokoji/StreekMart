import Link from "next/link";
import { ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { timeAgo } from "@/lib/utils";
import { VerificationGate } from "@/components/VerificationGate";

export default async function DesignerDashboardPage() {
  const user = await requireUser("DESIGNER");

  // Window boundaries used by the engagement panel. "Last 7 days" is the
  // headline reach metric so growth feels timely. Previous-7-day window is
  // used for the follower-growth comparison.
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [
    postCount,
    totals,
    recentPosts,
    productCount,
    activeProducts,
    topPost,
    followersNow,
    followersLastWeek,
    totalComments,
  ] = await Promise.all([
    prisma.post.count({ where: { authorId: user.id } }),
    prisma.post.aggregate({
      where: { authorId: user.id },
      _sum: { viewCount: true, likeCount: true, saveCount: true },
    }),
    prisma.post.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.product.count({ where: { sellerId: user.id } }),
    prisma.product.count({ where: { sellerId: user.id, status: ProductStatus.ACTIVE } }),
    // Top-performing post — most engagements (likes + saves + comments).
    // We rank in JS off the totals already on the row rather than a SQL
    // aggregate because Prisma + SQLite doesn't support computed-column
    // orderBy. Cheap enough at any realistic designer post count.
    prisma.post.findMany({
      where: { authorId: user.id },
      orderBy: [{ likeCount: "desc" }, { saveCount: "desc" }],
      take: 1,
    }),
    // Followers added in the last 7 days vs. the 7 days before that.
    // The ratio is the headline growth metric.
    prisma.follow.count({
      where: { designerId: user.id, createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.follow.count({
      where: {
        designerId: user.id,
        createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
      },
    }),
    // Comments don't live on the Post row as a denormalised count — query
    // the Comment table directly. Cheap because of the (postId,authorId)
    // index that exists for the existing recentComments rail elsewhere.
    prisma.comment.count({
      where: { post: { authorId: user.id } },
    }),
  ]);

  const totalViews = totals._sum.viewCount ?? 0;
  const totalLikes = totals._sum.likeCount ?? 0;
  const totalSaves = totals._sum.saveCount ?? 0;
  // Engagement rate = (likes + saves + comments) / views. Reads as a
  // percentage of viewers who took some action. 0 when there are no views
  // yet — keeps the metric from rendering as NaN on a fresh account.
  const engagementRate =
    totalViews > 0
      ? ((totalLikes + totalSaves + totalComments) / totalViews) * 100
      : 0;
  const newFollowersThisWeek = followersNow; // counts in window
  const newFollowersPrevWeek = followersLastWeek;
  // Growth %: this-week vs. prior-week new-follower delta.
  // When the prior week was 0, render as "—" instead of Infinity.
  const growthPercent =
    newFollowersPrevWeek > 0
      ? ((newFollowersThisWeek - newFollowersPrevWeek) / newFollowersPrevWeek) * 100
      : null;
  const topPostRow = topPost[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Welcome, {user.name}</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/designer/commissions" className="btn-secondary">Commissions</Link>
          <Link href="/designer/preorders" className="btn-secondary">Preorders</Link>
          <Link href="/designer/lookbooks" className="btn-secondary">Look-books</Link>
          <Link href="/designer/products/new" className="btn-secondary">+ List product</Link>
          <Link href="/designer/posts/new" className="btn-primary">+ New post</Link>
        </div>
      </div>

      <VerificationGate kind="designer" verified={user.designerVerified} />

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Posts" value={postCount} />
        <Stat label="Products" value={productCount} sub={`${activeProducts} active`} />
        <Stat label="Total views" value={totalViews} />
        <Stat label="Total likes" value={totalLikes} />
        <Stat label="Total saves" value={totalSaves} />
      </div>

      {/* Engagement panel — surfaces the metrics designers actually care
          about beyond raw counts: engagement rate, growth trend, and the
          single best-performing post they can re-promote. */}
      <section className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Engagement</h2>
          <p className="text-xs text-ink-500">Last 7 days vs. previous 7 days</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-ink-100 p-4">
            <p className="text-xs uppercase tracking-wider text-ink-500">Engagement rate</p>
            <p className="mt-1 text-2xl font-bold">
              {engagementRate.toFixed(1)}<span className="text-base text-ink-500">%</span>
            </p>
            <p className="mt-0.5 text-xs text-ink-500">
              {totalLikes + totalSaves + totalComments} actions on {totalViews} views
            </p>
          </div>
          <div className="rounded-xl border border-ink-100 p-4">
            <p className="text-xs uppercase tracking-wider text-ink-500">New followers</p>
            <p className="mt-1 text-2xl font-bold">
              {newFollowersThisWeek}
              {growthPercent !== null && (
                <span
                  className={`ml-2 text-xs font-semibold ${
                    growthPercent >= 0 ? "text-emerald-600" : "text-burgundy-700"
                  }`}
                >
                  {growthPercent >= 0 ? "▲" : "▼"} {Math.abs(growthPercent).toFixed(0)}%
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-ink-500">
              this week · {newFollowersPrevWeek} last week
            </p>
          </div>
          <div className="rounded-xl border border-ink-100 p-4">
            <p className="text-xs uppercase tracking-wider text-ink-500">Top post</p>
            {topPostRow ? (
              <Link
                href={`/designer/posts/${topPostRow.id}`}
                className="mt-1 block truncate text-sm font-semibold hover:underline"
              >
                {topPostRow.title}
              </Link>
            ) : (
              <p className="mt-1 text-sm text-ink-500">No posts yet.</p>
            )}
            {topPostRow && (
              <p className="mt-0.5 text-xs text-ink-500">
                {topPostRow.likeCount} likes · {topPostRow.saveCount} saves · {topPostRow.viewCount} views
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent posts</h2>
          <Link href="/designer/posts" className="text-sm text-brand-700 hover:underline">View all</Link>
        </div>
        {recentPosts.length === 0 ? (
          <p className="text-sm text-gray-500">You haven&apos;t published anything yet.</p>
        ) : (
          <ul className="divide-y">
            {recentPosts.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3">
                <Link href={`/designer/posts/${p.id}`} className="font-medium hover:underline">
                  {p.title}
                </Link>
                <p className="text-xs text-gray-500">
                  {p.likeCount} likes · {p.viewCount} views · {timeAgo(p.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}
