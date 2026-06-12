import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

// GET /api/coupons -- list claimable coupons + the calling user's
// existing claims. UI splits into "Available to claim" vs "My coupons".
export async function GET() {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const userId = guard.session.sub;
  const now = new Date();
  const [available, claims] = await Promise.all([
    prisma.promoCode.findMany({
      where: {
        claimable: true,
        enabled: true,
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.couponClaim.findMany({
      where: { userId },
      include: { promoCode: true },
      orderBy: { claimedAt: "desc" },
      take: 30,
    }),
  ]);
  const claimedIds = new Set(claims.map((c) => c.promoCodeId));
  return NextResponse.json({
    available: available.filter((p) => !claimedIds.has(p.id)).map(shape),
    mine: claims.map((c) => ({
      ...shape(c.promoCode),
      claimedAt: c.claimedAt.toISOString(),
    })),
  });
}

function shape(p: { id: string; code: string; kind: string; value: number; maxDiscountCents: number | null; minSubtotalCents: number | null; endsAt: Date | null; description: string | null }) {
  return {
    id: p.id,
    code: p.code,
    kind: p.kind,
    value: p.value,
    maxDiscountCents: p.maxDiscountCents,
    minSubtotalCents: p.minSubtotalCents,
    endsAt: p.endsAt?.toISOString() ?? null,
    description: p.description,
  };
}