import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { exposureDelta } from "@/lib/ranking";

const Body = z.object({
  kind: z.enum(["product", "post"]),
  id: z.string(),
});

// POST /api/likes — toggle like on a product or post.
// Bumps the target's likeCount and the owner's exposureScore.
export async function POST(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const userId = guard.session.sub;
  const { kind, id } = parsed.data;

  const where = kind === "product"
    ? { userId_productId: { userId, productId: id } }
    : { userId_postId: { userId, postId: id } };

  const existing = await prisma.like.findUnique({ where: where as never });

  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
    if (kind === "product") {
      await prisma.product.update({ where: { id }, data: { likeCount: { decrement: 1 } } });
    } else {
      await prisma.post.update({ where: { id }, data: { likeCount: { decrement: 1 } } });
    }
    return NextResponse.json({ liked: false });
  }

  await prisma.like.create({
    data: kind === "product" ? { userId, productId: id } : { userId, postId: id },
  });

  if (kind === "product") {
    const p = await prisma.product.update({
      where: { id },
      data: { likeCount: { increment: 1 } },
      select: { sellerId: true },
    });
    await prisma.user.update({
      where: { id: p.sellerId },
      data: { exposureScore: { increment: exposureDelta("like") } },
    });
  } else {
    const p = await prisma.post.update({
      where: { id },
      data: { likeCount: { increment: 1 } },
      select: { authorId: true },
    });
    await prisma.user.update({
      where: { id: p.authorId },
      data: { exposureScore: { increment: exposureDelta("like") } },
    });
  }

  return NextResponse.json({ liked: true });
}
