import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PreorderList } from "@/components/preorders/PreorderList";

export default async function SellerPreordersPage() {
  const user = await requireUser("SELLER");
  const rows = await prisma.preorder.findMany({
    where: { designerId: user.id, productId: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      buyer: { select: { id: true, name: true } },
      product: { select: { name: true } },
    },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Preorders</h1>
      <p className="text-sm text-ink-500">
        Custom requests from buyers tied to your preorder-enabled products.
      </p>
      <PreorderList
        rows={rows.map((r) => ({
          id: r.id,
          title: r.product?.name ?? "(product removed)",
          counterpartyName: r.buyer.name,
          priceCents: r.priceCents,
          status: r.status,
          updatedAt: r.updatedAt,
        }))}
        detailHref={(id) => `/seller/preorders/${id}`}
        emptyTitle="No preorders yet"
        emptyBody="Enable preorder on a product to start receiving requests."
      />
    </div>
  );
}
