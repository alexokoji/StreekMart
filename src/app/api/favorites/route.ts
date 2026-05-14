import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { exposureDelta } from "@/lib/ranking";

// GET /api/favorites — current user's saved items.
export async function GET() {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const favorites = await prisma.favorite.findMany({
    where: { userId: guard.session.sub },
    include: {
      product: { include: { seller: { select: { id: true, name: true } } } },
      post: { include: { author: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ favorites });
}

const Body = z.object({
  kind: z.enum(["product", "post"]),
  id: z.string(),
});

// POST /api/favorites — toggle save.
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

  const existing = await prisma.favorite.findUnique({ where: where as never });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    if (kind === "product") {
      await prisma.product.update({ where: { id }, data: { saveCount: { decrement: 1 } } });
    } else {
      await prisma.post.update({ where: { id }, data: { saveCount: { decrement: 1 } } });
    }
    return NextResponse.json({ saved: false });
  }

  await prisma.favorite.create({
    data: kind === "product" ? { userId, productId: id } : { userId, postId: id },
  });

  if (kind === "product") {
    const p = await prisma.product.update({
      where: { id },
      data: { saveCount: { increment: 1 } },
      select: { sellerId: true },
    });
    await prisma.user.update({
      where: { id: p.sellerId },
      data: { exposureScore: { increment: exposureDelta("save") } },
    });
  } else {
    const p = await prisma.post.update({
      where: { id },
      data: { saveCount: { increment: 1 } },
      select: { authorId: true },
    });
    await prisma.user.update({
      where: { id: p.authorId },
      data: { exposureScore: { increment: exposureDelta("save") } },
    });
  }

  return NextResponse.json({ saved: true });
}
