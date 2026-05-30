import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { CommissionList } from "@/components/commissions/CommissionList";

export default async function DesignerCommissionsPage() {
  const user = await requireUser("DESIGNER");
  const commissions = await prisma.commissionRequest.findMany({
    where: { designerId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      buyer: { select: { id: true, name: true } },
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Commissions</h1>
      <p className="text-sm text-ink-500">
        Custom-design requests from buyers. Quote, accept, deliver, and get paid through your wallet.
      </p>
      <CommissionList
        rows={commissions.map((c) => ({
          id: c.id,
          title: c.title,
          status: c.status,
          updatedAt: c.updatedAt,
          counterpartyName: c.buyer.name,
          quoteCents: c.quoteCents,
        }))}
        detailHref={(id) => `/designer/commissions/${id}`}
        emptyTitle="No commissions yet"
        emptyBody="When a buyer briefs you, requests land here."
      />
    </div>
  );
}
