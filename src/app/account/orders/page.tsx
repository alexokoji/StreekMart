import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { displaySellerName } from "@/lib/businessName";
import { parseJsonArray, timeAgo } from "@/lib/utils";
import { Price } from "@/components/Price";
import { OrderActions } from "./OrderActions";

export default async function BuyerOrdersPage() {
  const user = await requireUser();
  const orders = await prisma.order.findMany({
    where: { buyerId: user.id },
    include: {
      product: { select: { id: true, name: true, imagesJson: true } },
      seller: { select: { id: true, slug: true, name: true, businessName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = Date.now();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Your orders</h1>
        <p className="text-sm text-ink-600">Every purchase you&apos;ve made on StreekMart.</p>
      </div>

      {orders.length === 0 ? (
        <div className="card p-10 text-center text-sm text-ink-500">
          No orders yet. Browse the{" "}
          <Link href="/" className="text-violet-700 hover:underline">storefront</Link>{" "}
          to start shopping.
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const image = parseJsonArray(o.product.imagesJson)[0] ?? null;
            const handle = o.seller.slug ?? o.seller.id;

            // Cancellation rules mirror /api/orders/[id] PATCH:
            //   PENDING       → always cancellable
            //   PAID/SHIPPED  → only after expectedDeliveryBy passes
            //   COMPLETED     → never (open dispute instead)
            //   CANCELLED     → already gone
            let cancellable = false;
            let cancelHint = "";
            if (o.status === "PENDING") {
              cancellable = true;
            } else if (o.status === "PAID" || o.status === "SHIPPED") {
              const deadline = o.expectedDeliveryBy?.getTime() ?? 0;
              if (deadline > 0 && now >= deadline) {
                cancellable = true;
                cancelHint = "Delivery window has passed. Cancel to start a refund.";
              } else if (deadline > 0) {
                const days = Math.ceil((deadline - now) / (24 * 60 * 60 * 1000));
                cancelHint = `Self-cancel unlocks in ~${days} day${days === 1 ? "" : "s"} if the order hasn't arrived.`;
              }
            } else if (o.status === "COMPLETED") {
              cancelHint = "This order was confirmed delivered.";
            }

            return (
              <li key={o.id} className="card flex items-start gap-4 p-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-ink-100">
                  {image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt={o.product.name} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/products/${o.product.id}`}
                    className="font-medium hover:underline"
                  >
                    {o.product.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-ink-500">
                    Sold by{" "}
                    <Link href={`/u/${handle}`} className="text-violet-700 hover:underline">
                      {displaySellerName(o.seller)}
                    </Link>
                    {" · "}
                    {timeAgo(o.createdAt)}
                    {o.paymentMethod === "ON_DELIVERY" && (
                      <span className="ml-2 rounded-full bg-gold-50 px-2 py-0.5 text-[10px] font-medium text-gold-700">
                        Pay on delivery
                      </span>
                    )}
                  </p>
                  {/* Delivery code — buyer shares this with the rider at the
                      door so the rider can confirm via /deliver/[orderId]. */}
                  {o.deliveryCode && (o.status === "PAID" || o.status === "SHIPPED") && (
                    <p className="mt-1 text-xs">
                      <span className="text-ink-500">Delivery code:</span>{" "}
                      <span className="rounded-md border border-ink-200 bg-ink-50 px-2 py-0.5 font-mono text-sm font-bold tracking-widest text-ink-800">
                        {o.deliveryCode}
                      </span>
                      <span className="ml-2 text-[11px] text-ink-500">
                        Share with the dispatch rider on arrival.
                      </span>
                    </p>
                  )}
                  <p className="mt-1 text-xs">
                    <Link
                      href={`/account/orders/${o.id}`}
                      className="text-violet-700 hover:underline"
                    >
                      View tracking →
                    </Link>
                  </p>
                  <OrderActions
                    orderId={o.id}
                    status={o.status}
                    cancellable={cancellable}
                    cancelHint={cancelHint}
                  />
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold"><Price amount={o.totalPrice} /></p>
                  <span className="badge mt-1 bg-ink-50 text-ink-700">{o.status}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
