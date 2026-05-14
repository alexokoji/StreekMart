import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { Price } from "@/components/Price";
import { OrderStatusActions } from "./OrderStatusActions";

export default async function ViewOrderPage({ params }: { params: { id: string } }) {
  const user = await requireUser("SELLER");
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      product: true,
      buyer: { select: { id: true, name: true, email: true } },
    },
  });
  if (!order || order.sellerId !== user.id) notFound();

  return (
    <div className="space-y-6">
      <Link href="/seller/orders/active" className="text-sm text-brand-700 hover:underline">← Back to orders</Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-6 lg:col-span-2">
          <h1 className="text-2xl font-bold">Order #{order.id.slice(0, 8)}</h1>
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
            <ContactBuyerButton buyerId={order.buyer.id} />
          </div>

          <div className="card p-6">
            <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500">Status</h2>
            <p className="text-lg font-semibold">{order.status}</p>
            <OrderStatusActions orderId={order.id} status={order.status} />
          </div>
        </aside>
      </div>
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
