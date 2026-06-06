import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PreorderList } from "@/components/preorders/PreorderList";
import { displaySellerName } from "@/lib/businessName";

export default async function BuyerPreordersPage() {
  const user = await requireUser();
  const rows = await prisma.preorder.findMany({
    where: { buyerId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      designer: { select: { id: true, name: true, businessName: true } },
      post: { select: { title: true } },
    },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">My preorders</h1>
      <p className="text-sm text-ink-500">
        Designs you&rsquo;ve requested directly from designers&rsquo; posts.
      </p>
      <PreorderList
        rows={rows.map((r) => ({
          id: r.id,
          title: r.post?.title ?? "(post removed)",
          counterpartyName: displaySellerName(r.designer),
          priceCents: r.priceCents,
          status: r.status,
          updatedAt: r.updatedAt,
        }))}
        detailHref={(id) => `/account/preorders/${id}`}
        emptyTitle="No preorders yet"
        emptyBody="Open a designer's post in the feed and tap Preorder this piece."
      />
    </div>
  );
}
