import { NextResponse } from "next/server";
import { Permission, ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

// GET /api/dashboard/designer -- mirrors the data shown on the web
// designer dashboard. Returns post + product KPIs, engagement window,
// follower growth, recent posts. Used by mobile DesignerDashboardScreen.
export async function GET() {
  const guard = await requireApiUser(Permission.DESIGNER);
  if ("error" in guard) return guard.error;
  const userId = guard.session.sub;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [
    postCount,
    totals,
    recentPosts,
    productCount,
    activeProducts,
    followersNow,
    followersLastWeek,
    totalComments,
    activeCommissions,
    activePreorders,
  ] = await Promise.all([
    prisma.post.count({ where: { authorId: userId } }),
    prisma.post.aggregate({
      where: { authorId: userId },
      _sum: { viewCount: true, likeCount: true, saveCount: true },
    }),
    prisma.post.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, likeCount: true, viewCount: true, saveCount: true, imagesJson: true, createdAt: true },
    }),
    prisma.product.count({ where: { sellerId: userId } }),
    prisma.product.count({ where: { sellerId: userId, status: ProductStatus.ACTIVE } }),
    prisma.follow.count({ where: { designerId: userId, createdAt: { gte: sevenDaysAgo } } }),
    prisma.follow.count({ where: { designerId: userId, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
    prisma.comment.count({ where: { post: { authorId: userId } } }),
    prisma.commissionRequest.count({ where: { designerId: userId, status: { notIn: ["COMPLETED", "CANCELLED"] } } }).catch(() => 0),
    prisma.preorder.count({ where: { designerId: userId, status: { notIn: ["COMPLETED", "CANCELLED"] } } }).catch(() => 0),
  ]);

  const totalViews = totals._sum.viewCount ?? 0;
  const totalLikes = totals._sum.likeCount ?? 0;
  const totalSaves = totals._sum.saveCount ?? 0;
  const engagementRate =
    totalViews > 0
      ? ((totalLikes + totalSaves + totalComments) / totalViews) * 100
      : 0;
  const growthPercent =
    followersLastWeek > 0
      ? ((followersNow - followersLastWeek) / followersLastWeek) * 100
      : null;

  return NextResponse.json({
    stats: {
      postCount,
      productCount,
      activeProducts,
      totalViews,
      totalLikes,
      totalSaves,
      totalComments,
      engagementRate: Math.round(engagementRate * 10) / 10,
      newFollowersThisWeek: followersNow,
      newFollowersPrevWeek: followersLastWeek,
      growthPercent,
      activeCommissions,
      activePreorders,
    },
    recentPosts: recentPosts.map((p) => {
      let firstImage: string | null = null;
      try {
        const parsed = JSON.parse(p.imagesJson ?? "[]");
        if (Array.isArray(parsed) && typeof parsed[0] === "string") firstImage = parsed[0];
      } catch {
        firstImage = null;
      }
      return {
        id: p.id,
        title: p.title,
        likeCount: p.likeCount,
        viewCount: p.viewCount,
        saveCount: p.saveCount,
        image: firstImage,
        createdAt: p.createdAt.toISOString(),
      };
    }),
  });
}