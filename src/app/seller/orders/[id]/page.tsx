import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { Price } from "@/components/Price";
import { OrderStatusActions } from "./OrderStatusActions";
import { TrackingUpdater } from "./TrackingUpdater";
import SellerShipmentPanel from "./SellerShipmentPanel";

export default async function ViewOrderPage({ params }: { params: { id: string } }) {
  const user = await requireUser("SELLER");
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      product: true,
      seller: { select: { sellerVerified: true } },
      // Phone is shown to the seller once payment is confirmed — sellers
      // call buyers about delivery windows, missed doors, etc.
      buyer: { select: { id: true, name: true, email: true, phone: true } },
      shippingRates: true,
      shipment: true,
    },
  });
  if (!order || order.sellerId !== user.id) notFound();

  return (
    <div className="space-y-6">
      <Link href="/seller/orders/active" className="text-sm text-brand-700 hover:underline">← Back to orders</Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">Order #{order.id.slice(0, 8)}</h1>
            {order.status === "PAID" && !order.shipment && (
              <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold uppercase text-yellow-800">
                Shipment pending
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">Placed {formatDate(order.createdAt)}</p>

          <div className="mt-6">
            <h2 className="text-sm font-semibold uppercase text-gray-500">Product</h2>
            <Link href={`/seller/products/${order.product.id}`} className="mt-1 block text-lg font-medium hover:underline">
              {order.product.name}
            </Link>
            <p className="text-sm text-gray-600">{order.product.description}</p>
          </div>

          <dl className="mt-6 grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">Quantity</dt>
              <dd className="font-medium">{order.quantity}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Unit price</dt>
              <dd className="font-medium"><Price amount={order.product.price} /></dd>
            </div>
            <div>
              <dt className="text-gray-500">Total</dt>
              <dd className="font-medium"><Price amount={order.totalPrice} /></dd>
            </div>
          </dl>

          {order.shippingAddress && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold uppercase text-gray-500">Shipping address</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm">{order.shippingAddress}</p>
            </div>
          )}
          {order.notes && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold uppercase text-gray-500">Buyer notes</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm">{order.notes}</p>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="card p-6">
            <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500">Buyer</h2>
            <p className="font-medium">{order.buyer.name}</p>
            <p className="text-sm text-gray-600">{order.buyer.email}</p>
            {/* Phone — hidden on PENDING so abandoned checkouts don't leak
                contact info before payment lands. */}
            {order.status !== "PENDING" && order.buyer.phone && (
              <a
                href={`tel:${order.buyer.phone.replace(/\s+/g, "")}`}
                className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-violet-700 hover:underline"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                {order.buyer.phone}
              </a>
            )}
            <ContactBuyerButton buyerId={order.buyer.id} />
          </div>

          <div className="card p-6">
            <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500">Status</h2>
            <p className="text-lg font-semibold">{order.status}</p>
            <OrderStatusActions orderId={order.id} status={order.status} />
          </div>

          {order.deliveryCode && (
            <div className="card p-6">
              <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500">Delivery code</h2>
              <p className="font-mono text-2xl font-bold tracking-[0.4em]">{order.deliveryCode}</p>
              <p className="mt-2 text-xs text-ink-500">
                Buyer reads this to the rider at the door. Rider keys it in at{" "}
                <code className="rounded bg-ink-50 px-1">{`/deliver/${order.id.slice(0, 8)}…`}</code>{" "}
                to mark the order delivered.
              </p>
            </div>
          )}

          {/* Seller shipment panel: shows buyer-selected shipping choice and
              provides a CTA for the seller to create the shipment. */}
          <SellerShipmentPanel
            orderId={order.id}
            shippingRates={order.shippingRates}
            shipment={order.shipment}
            sellerVerified={order.seller?.sellerVerified ?? false}
          />
        </aside>
      </div>

      <TrackingUpdater orderId={order.id} />
    </div>
  );
}

function ContactBuyerButton({ buyerId }: { buyerId: string }) {
  return (
    <Link href={`/messages?with=${buyerId}`} className="btn-secondary mt-3 w-full text-center">
      Message buyer
    </Link>
  );
}
