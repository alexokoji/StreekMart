import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseJsonArray } from "@/lib/utils";
import { CommissionDetail } from "@/components/commissions/CommissionDetail";

export default async function BuyerCommissionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  const c = await prisma.commissionRequest.findUnique({
    where: { id: params.id },
    include: {
      buyer: { select: { id: true, name: true } },
      designer: { select: { id: true, name: true } },
    },
  });
  if (!c || c.buyerId !== user.id) notFound();

  return (
    <CommissionDetail
      actor="buyer"
      initialCommission={{
        id: c.id,
        status: c.status,
        title: c.title,
        description: c.description,
        occasion: c.occasion,
        budgetCents: c.budgetCents,
        deadlineAt: c.deadlineAt?.toISOString() ?? null,
        references: parseJsonArray(c.referencesJson),
        quoteCents: c.quoteCents,
        quoteNote: c.quoteNote,
        quotedAt: c.quotedAt?.toISOString() ?? null,
        estimatedDays: c.estimatedDays,
        deliveryCode: c.deliveryCode,
        deliveredAt: c.deliveredAt?.toISOString() ?? null,
        completedAt: c.completedAt?.toISOString() ?? null,
        cancellationReason: c.cancellationReason,
        createdAt: c.createdAt.toISOString(),
        buyer: c.buyer,
        designer: c.designer,
      }}
    />
  );
}
