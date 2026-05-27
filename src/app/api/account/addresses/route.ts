import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { recomputeSellerTier } from "@/lib/tiers";

const AddressKind = z.enum(["DELIVERY", "PICKUP"]);

const CreateBody = z.object({
  kind: AddressKind,
  label: z.string().max(60).optional(),
  phone: z.string().max(30).optional(),
  formattedAddress: z.string().min(3).max(500),
  placeId: z.string().max(255).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  city: z.string().max(120).optional(),
  region: z.string().max(120).optional(),
  country: z.string().max(60).optional(),
  isDefault: z.boolean().optional(),
});

export async function GET(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const url = new URL(req.url);
  const kindParam = url.searchParams.get("kind");
  const kind = kindParam && AddressKind.safeParse(kindParam).success ? kindParam : undefined;

  const addresses = await prisma.address.findMany({
    where: { userId: guard.session.sub, ...(kind ? { kind } : {}) },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({ ok: true, addresses });
}

export async function POST(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  const { kind, isDefault, ...data } = parsed.data;
  const userId = guard.session.sub;

  // If this is the user's first address of this kind, force isDefault=true so the
  // checkout flow always has something to pre-select.
  const existingCount = await prisma.address.count({ where: { userId, kind } });
  const shouldBeDefault = isDefault === true || existingCount === 0;

  const address = await prisma.$transaction(async (tx) => {
    if (shouldBeDefault) {
      await tx.address.updateMany({
        where: { userId, kind, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.address.create({
      data: {
        userId,
        kind,
        isDefault: shouldBeDefault,
        ...data,
      },
    });
  });

  // A new PICKUP address can unlock Tier 2 for an already-verified seller.
  if (kind === "PICKUP") {
    await recomputeSellerTier(userId);
  }

  return NextResponse.json({ ok: true, address });
}
