import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PreorderList } from "@/components/preorders/PreorderList";

export default async function DesignerPreordersPage() {
  const user = await requireUser("DESIGNER");
  const rows = await prisma.preorder.findMany({
    where: { designerId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      buyer: { select: { id: true, name: true } },
      post: { select: { title: true } },
    },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Preorders</h1>
      <p className="text-sm text-ink-500">
        Custom requests from buyers tied to your published pieces.
      </p>
      <PreorderList
        rows={rows.map((r) => ({
          id: r.id,
          title: r.post?.title ?? "(post removed)",
          counterpartyName: r.buyer.name,
          priceCents: r.priceCents,
          status: r.status,
          updatedAt: r.updatedAt,
        }))}
        detailHref={(id) => `/designer/preorders/${id}`}
        emptyTitle="No preorders yet"
        emptyBody="Enable preorder on a published post to start receiving requests."
      />
    </div>
  );
}
