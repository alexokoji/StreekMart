import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

// POST /api/coupons/[code]/claim -- save a claimable coupon to the
// caller's account. Idempotent -- repeat claims return 200 with the
// existing claim. Hidden / disabled / expired codes are rejected so
// users can't probe for non-claimable codes.
export async function POST(_req: Request, { params }: { params: { code: string } }) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const userId = guard.session.sub;
  const code = params.code.trim().toUpperCase();
  const promo = await prisma.promoCode.findUnique({ where: { code } });
  if (!promo || !promo.claimable || !promo.enabled) {
    return NextResponse.json({ error: "Coupon not available." }, { status: 404 });
  }
  const now = new Date();
  if (promo.endsAt && promo.endsAt < now) {
    return NextResponse.json({ error: "Coupon has expired." }, { status: 400 });
  }
  const existing = await prisma.couponClaim.findUnique({
    where: { userId_promoCodeId: { userId, promoCodeId: promo.id } },
  });
  if (existing) return NextResponse.json({ ok: true, claim: existing, alreadyClaimed: true });
  const claim = await prisma.couponClaim.create({
    data: { userId, promoCodeId: promo.id },
  });
  return NextResponse.json({ ok: true, claim });
}