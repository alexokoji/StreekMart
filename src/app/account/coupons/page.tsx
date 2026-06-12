import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { CouponsClient } from "./CouponsClient";

// /account/coupons -- collect publicly claimable promo codes. A claimed
// coupon shows in "My coupons" so the user can reference the code at
// checkout without remembering it.
export default async function CouponsPage() {
  const user = await requireUser();
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
      where: { userId: user.id },
      include: { promoCode: true },
      orderBy: { claimedAt: "desc" },
    }),
  ]);
  const claimedIds = new Set(claims.map((c) => c.promoCodeId));
  const filteredAvailable = available.filter((p) => !claimedIds.has(p.id));
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Coupons</h1>
        <p className="text-sm text-ink-600">
          Save coupons to your account, then use the code at checkout.
        </p>
      </div>
      <CouponsClient
        initialAvailable={filteredAvailable.map(shape)}
        initialMine={claims.map((c) => ({
          ...shape(c.promoCode),
          claimedAt: c.claimedAt.toISOString(),
        }))}
      />
    </div>
  );
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