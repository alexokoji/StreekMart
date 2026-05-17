import { OrderStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { listRiderOwnerIds } from "@/lib/managersServer";
import { Price } from "@/components/Price";
import { timeAgo } from "@/lib/utils";

// /rider/completed — recent successful drops. Capped at 50 so the page
// stays snappy on a phone with patchy signal.
export default async function RiderCompletedPage() {
  const user = await requireUser();
  const ownerIds = await listRiderOwnerIds(user.id);

  const orders = await prisma.order.findMany({
    where: { sellerId: { in: ownerIds }, status: OrderStatus.COMPLETED },
    orderBy: { completedAt: "desc" },
    take: 50,
    include: {
      product: { select: { name: true } },
      buyer: { select: { name: true, city: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Completed deliveries</h1>
        <p className="text-sm text-ink-600">Your last 50 successful drops.</p>
      </div>

      {orders.length === 0 ? (
        <div className="card p-10 text-center text-sm text-ink-500">No completed deliveries yet.</div>
      ) : (
        <ul className="card divide-y divide-ink-100">
          {orders.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p className="line-clamp-1 font-medium">{o.product.name}</p>
                <p className="text-[11px] text-ink-500">
                  {o.buyer.name} · {o.buyer.city ?? "—"} ·{" "}
                  {o.completedAt ? `delivered ${timeAgo(o.completedAt)}` : "delivered"}
                  {o.completedByRider && (
                    <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-accent">
                      Confirmed by you
                    </span>
                  )}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold"><Price amount={o.totalPrice} /></p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
