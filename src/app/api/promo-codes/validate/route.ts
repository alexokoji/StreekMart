import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

const Body = z.object({
  code: z.string().trim().toUpperCase().min(2).max(40),
  subtotalCents: z.number().int().nonnegative(),
});

// POST /api/promo-codes/validate { code, subtotalCents }
//
// Pure check -- does NOT consume a redemption. Returns the discountCents
// the buyer would get if they used this code on a cart of the given
// subtotal. Cart checkout calls this on apply, then again on payment
// confirmation to actually record a redemption.
export async function POST(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ valid: false, error: "Invalid input" }, { status: 400 });
  }
  const { code, subtotalCents } = parsed.data;

  const promo = await prisma.promoCode.findUnique({ where: { code } });
  if (!promo || !promo.enabled) {
    return NextResponse.json({ valid: false, error: "Code not found." }, { status: 404 });
  }
  const now = new Date();
  if (promo.startsAt && promo.startsAt > now) {
    return NextResponse.json({ valid: false, error: "Code is not active yet." }, { status: 400 });
  }
  if (promo.endsAt && promo.endsAt < now) {
    return NextResponse.json({ valid: false, error: "Code has expired." }, { status: 400 });
  }
  if (promo.minSubtotalCents && subtotalCents < promo.minSubtotalCents) {
    return NextResponse.json(
      { valid: false, error: `Minimum order of NGN ${Math.round(promo.minSubtotalCents / 100)} required.` },
      { status: 400 },
    );
  }
  if (promo.usageLimit) {
    const total = await prisma.promoCodeRedemption.count({ where: { promoCodeId: promo.id } });
    if (total >= promo.usageLimit) {
      return NextResponse.json({ valid: false, error: "Code is out of uses." }, { status: 400 });
    }
  }
  const myUsage = await prisma.promoCodeRedemption.count({
    where: { promoCodeId: promo.id, userId: guard.session.sub },
  });
  if (myUsage >= promo.perUserLimit) {
    return NextResponse.json({ valid: false, error: "You've already used this code." }, { status: 400 });
  }

  // Compute discount
  let discountCents = 0;
  if (promo.kind === "FLAT") {
    discountCents = promo.value;
  } else if (promo.kind === "PERCENT") {
    // value is basis points (1500 = 15%)
    discountCents = Math.round((subtotalCents * promo.value) / 10_000);
    if (promo.maxDiscountCents && discountCents > promo.maxDiscountCents) {
      discountCents = promo.maxDiscountCents;
    }
  }
  if (discountCents > subtotalCents) discountCents = subtotalCents;

  return NextResponse.json({
    valid: true,
    discountCents,
    promo: {
      code: promo.code,
      kind: promo.kind,
      description: promo.description,
    },
  });
}