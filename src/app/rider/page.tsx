import Link from "next/link";
import { OrderStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { listRiderOwnerIds } from "@/lib/managersServer";
import { Price } from "@/components/Price";
import { timeAgo } from "@/lib/utils";
import { deliveryZoneLabel, type DeliveryZone } from "@/lib/location";
import { RiderActions } from "./RiderActions";

// /rider — active-deliveries dashboard for a delivery rider.
//
// Pulls every order that:
//   - belongs to one of the sellers this user rides for
//   - is in PAID or SHIPPED status (i.e. owes a delivery)
// Each row gives the rider one-tap access to the confirm-by-code form, the
// buyer's address + phone (where available), and a "Mark out for delivery"
// quick-action that posts a DISPATCHED tracking update visible to the buyer.

export default async function RiderActiveDeliveriesPage() {
  const user = await requireUser();
  const ownerIds = await listRiderOwnerIds(user.id);

  const orders = await prisma.order.findMany({
    where: {
      sellerId: { in: ownerIds },
      status: { in: [OrderStatus.PAID, OrderStatus.SHIPPED] },
    },
    orderBy: [{ status: "asc" }, { paidAt: "asc" }],
    include: {
      product: { select: { id: true, name: true, imagesJson: true } },
      buyer: { select: { name: true, city: true, region: true, country: true } },
      seller: { select: { id: true, name: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Active deliveries</h1>
        <p className="text-sm text-ink-600">
          One row per order waiting on delivery. Tap a card to confirm with the buyer&apos;s
          4-character code, or post a status update so they can track your progress.
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="card p-10 text-center text-sm text-ink-500">
          Nothing to deliver right now.
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-widest text-ink-500">
                    {o.seller.name} · {deliveryZoneLabel(o.deliveryZone as DeliveryZone)}
                  </p>
                  <p className="mt-0.5 font-display text-base font-semibold">
                    {o.product.name}
                  </p>
                  <p className="text-xs text-ink-500">
                    {o.quantity} × · <Price amount={o.totalPrice} /> · {timeAgo(o.createdAt)}
                  </p>
                  <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="font-semibold uppercase tracking-widest text-ink-500">Buyer</dt>
                      <dd className="mt-0.5 font-medium">{o.buyer.name}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold uppercase tracking-widest text-ink-500">Delivery to</dt>
                      <dd className="mt-0.5">
                        {o.buyer.city ?? "—"}
                        {o.buyer.region ? `, ${o.buyer.region}` : ""}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="font-semibold uppercase tracking-widest text-ink-500">Address</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap">{o.shippingAddress ?? "—"}</dd>
                    </div>
                  </dl>
                </div>
                <div className="text-right">
                  <span className="badge bg-ink-50 text-ink-700">{o.status}</span>
                </div>
              </div>
              <RiderActions orderId={o.id} status={o.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
