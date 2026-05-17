import { NextResponse } from "next/server";
import { z } from "zod";
import { Permission } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

// PATCH /api/account/delivery-fees
//
// Sellers + designers (anyone who lists products) configure their delivery
// rates here. Stored in USD-cents on the User row so the cart endpoint can
// snapshot the current rate at order time.
//
// Buyers shouldn't hit this — guarded by the SELLER/DESIGNER permission check.

const Body = z.object({
  withinCity: z.number().int().min(0).max(1_000_000),
  outsideCity: z.number().int().min(0).max(1_000_000),
  outsideCountry: z.number().int().min(0).max(1_000_000),
});

export async function PATCH(req: Request) {
  const guard = await requireApiUser([Permission.SELLER, Permission.DESIGNER]);
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  // Soft sanity: outsideCountry should usually be ≥ outsideCity ≥ withinCity.
  // We warn rather than reject so a seller with a flat international rate
  // (e.g. integrated DHL) isn't blocked.
  const updated = await prisma.user.update({
    where: { id: guard.session.sub },
    data: {
      deliveryWithinCityCents: parsed.data.withinCity,
      deliveryOutsideCityCents: parsed.data.outsideCity,
      deliveryOutsideCountryCents: parsed.data.outsideCountry,
    },
    select: {
      deliveryWithinCityCents: true,
      deliveryOutsideCityCents: true,
      deliveryOutsideCountryCents: true,
    },
  });
  return NextResponse.json({ ok: true, ...updated });
}
