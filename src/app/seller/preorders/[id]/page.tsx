import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { parseJsonArray } from "@/lib/utils";
import { buildWatermarkedUrl } from "@/lib/cloudinaryUrl";
import { PreorderDetail } from "@/components/preorders/PreorderDetail";

export default async function SellerPreorderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser("SELLER");
  const p = await prisma.preorder.findUnique({
    where: { id: params.id },
    include: {
      buyer: { select: { id: true, name: true } },
      designer: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, imagesJson: true } },
    },
  });
  if (!p || p.designerId !== user.id || !p.productId) notFound();
  return (
    <PreorderDetail
      actor="designer"
      backHref="/seller/preorders"
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
        post: null,
        product: p.product
          ? {
              id: p.product.id,
              title: p.product.name,
              coverUrl: buildWatermarkedUrl(parseJsonArray(p.product.imagesJson)[0] ?? ""),
            }
          : null,
      }}
    />
  );
}
