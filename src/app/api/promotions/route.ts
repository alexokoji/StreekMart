import { NextResponse } from "next/server";
import { z } from "zod";
import { Permission } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { hasManagerPermission } from "@/lib/managers";

// POST /api/promotions { kind, id, days, boost? }
// Sellers can promote their products; designers their posts.
const Body = z.object({
  kind: z.enum(["product", "post"]),
  id: z.string(),
  days: z.number().int().positive().max(60).default(7),
  boost: z.number().min(1).max(5).optional(),
});

export async function POST(req: Request) {
  const guard = await requireApiUser([Permission.SELLER, Permission.DESIGNER]);
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { kind, id, days, boost } = parsed.data;

  // Ownership / manager check. Promotion is recorded under the *owner's*
  // wallet, not the manager's, so we resolve the owner here too.
  let ownerId: string | null = null;
  if (kind === "product") {
    const p = await prisma.product.findUnique({ where: { id } });
    if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const ok = await hasManagerPermission(guard.session.sub, p.sellerId, "manage_promotions");
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    ownerId = p.sellerId;
  } else {
    const p = await prisma.post.findUnique({ where: { id } });
    if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const ok = await hasManagerPermission(guard.session.sub, p.authorId, "manage_promotions");
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    ownerId = p.authorId;
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const promotion = await prisma.promotion.create({
    data: {
      ownerId,
      productId: kind === "product" ? id : undefined,
      postId: kind === "post" ? id : undefined,
      boost: boost ?? 1.5,
      startsAt: now,
      endsAt,
      active: true,
    },
  });

  return NextResponse.json({ promotion });
}
