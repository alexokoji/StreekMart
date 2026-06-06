import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseJsonArray } from "@/lib/utils";
import { buildWatermarkedUrl } from "@/lib/cloudinaryUrl";
import { PreorderDetail } from "@/components/preorders/PreorderDetail";

export default async function DesignerPreorderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser("DESIGNER");
  const p = await prisma.preorder.findUnique({
    where: { id: params.id },
    include: {
      buyer: { select: { id: true, name: true } },
      designer: { select: { id: true, name: true } },
      post: { select: { id: true, title: true, imagesJson: true } },
    },
  });
  if (!p || p.designerId !== user.id) notFound();
  return (
    <PreorderDetail
      actor="designer"
      initial={{
        id: p.id,
        status: p.status,
        priceCents: p.priceCents,
        leadDays: p.leadDays,
        notes: p.notes,
        designPaidAt: p.designPaidAt?.toISOString() ?? null,
        estimatedReadyAt: p.estimatedReadyAt?.toISOString() ?? null,
        readyAt: p.readyAt?.toISOString() ?? null,
        deliveryFeeCents: p.deliveryFeeCents,
        deliveryPaidAt: p.deliveryPaidAt?.toISOString() ?? null,
        shippingAddress: p.shippingAddress,
        trackingCode: p.trackingCode,
        logisticsProvider: p.logisticsProvider,
        deliveryCode: p.deliveryCode,
        shippedAt: p.shippedAt?.toISOString() ?? null,
        completedAt: p.completedAt?.toISOString() ?? null,
        cancellationReason: p.cancellationReason,
        createdAt: p.createdAt.toISOString(),
        buyer: p.buyer,
        designer: p.designer,
        post: p.post
          ? {
              id: p.post.id,
              title: p.post.title,
              coverUrl: buildWatermarkedUrl(parseJsonArray(p.post.imagesJson)[0] ?? ""),
            }
          : null,
      }}
    />
  );
}
