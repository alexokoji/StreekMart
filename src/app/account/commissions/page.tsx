import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { CommissionList } from "@/components/commissions/CommissionList";
import { displaySellerName } from "@/lib/businessName";

export default async function BuyerCommissionsPage() {
  const user = await requireUser();
  const commissions = await prisma.commissionRequest.findMany({
    where: { buyerId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      designer: { select: { id: true, name: true, businessName: true } },
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">My commissions</h1>
      <p className="text-sm text-ink-500">
        Track custom design requests you&rsquo;ve sent to designers.
      </p>
      <CommissionList
        rows={commissions.map((c) => ({
          id: c.id,
          title: c.title,
          status: c.status,
          updatedAt: c.updatedAt,
          counterpartyName: displaySellerName(c.designer),
          quoteCents: c.quoteCents,
        }))}
        detailHref={(id) => `/account/commissions/${id}`}
        emptyTitle="No commissions yet"
        emptyBody="Browse a designer's profile and tap “Request a commission”."
      />
    </div>
  );
}
