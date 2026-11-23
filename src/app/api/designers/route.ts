import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/designers?limit=12
//
// The curated "Top designers" list shown on the home page: Tier 2+ designers
// ranked by exposure. Public — same data the web home page renders.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "12", 10) || 12, 1), 50);

  const rows = await prisma.user.findMany({
    where: { isDesigner: true, designerTier: { gte: 2 }, suspendedAt: null },
    orderBy: { exposureScore: "desc" },
    take: limit,
    select: {
      id: true,
      slug: true,
      name: true,
      businessName: true,
      bio: true,
      avatarUrl: true,
      coverImageUrl: true,
      designerVerified: true,
      _count: { select: { posts: true } },
    },
  });
  const followerCounts = await prisma.follow.groupBy({
    by: ["designerId"],
    where: { designerId: { in: rows.map((r) => r.id) } },
    _count: { _all: true },
  });
  const followers = new Map(followerCounts.map((f) => [f.designerId, f._count._all]));

  return NextResponse.json({
    designers: rows.map((r) => ({
      id: r.slug ?? r.id,
      name: r.name,
      businessName: r.businessName,
      avatarUrl: r.avatarUrl,
      bannerUrl: r.coverImageUrl,
      followerCount: followers.get(r.id) ?? 0,
      productCount: r._count.posts,
      tagline: r.bio,
      verified: r.designerVerified,
    })),
  });
}
