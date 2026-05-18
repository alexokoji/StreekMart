import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";

// PATCH /api/admin/delivery-fees/[userId]
//
// Admin endpoint for setting a seller's / designer's own-rider delivery
// rates. These rates are used by the cart's deliveryQuote logic when:
//   - the seller's city is NOT on the platform DeliveryCity whitelist, or
//   - the seller has a rider and the order is cross-city.
//
// The seller can no longer edit these themselves — admin moderation owns
// pricing across the platform. See /admin/delivery for the overview.

const Body = z.object({
  withinCity: z.number().int().min(0).max(1_000_000).optional(),
  outsideCity: z.number().int().min(0).max(1_000_000).optional(),
  outsideCountry: z.number().int().min(0).max(1_000_000).optional(),
});

export async function PATCH(req: Request, { params }: { params: { userId: string } }) {
  const guard = await requireApiAdmin();
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const updated = await prisma.user.update({
    where: { id: params.userId },
    data: {
      ...(parsed.data.withinCity !== undefined && { deliveryWithinCityCents: parsed.data.withinCity }),
      ...(parsed.data.outsideCity !== undefined && { deliveryOutsideCityCents: parsed.data.outsideCity }),
      ...(parsed.data.outsideCountry !== undefined && { deliveryOutsideCountryCents: parsed.data.outsideCountry }),
    },
    select: {
      id: true,
      deliveryWithinCityCents: true,
      deliveryOutsideCityCents: true,
      deliveryOutsideCountryCents: true,
    },
  });
  return NextResponse.json({ ok: true, ...updated });
}
