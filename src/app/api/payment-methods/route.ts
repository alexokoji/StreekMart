import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";

// GET /api/payment-methods -- list cards saved by the calling user.
// Populated by the post-payment hook (Phase 4 wires this) when the
// buyer opts to save a card. We never store raw PANs -- just the
// gateway token + masked display details.
export async function GET() {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const rows = await prisma.savedPaymentMethod.findMany({
    where: { userId: guard.session.sub },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({
    methods: rows.map((m) => ({
      id: m.id,
      gateway: m.gateway,
      maskedPan: m.maskedPan,
      brand: m.brand,
      expMonth: m.expMonth,
      expYear: m.expYear,
      isDefault: m.isDefault,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}