import Link from "next/link";
import { OrderStatus, ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { timeAgo } from "@/lib/utils";
import { Price } from "@/components/Price";
import { VerificationGate } from "@/components/VerificationGate";

export default async function SellerDashboardPage() {
  const user = await requireUser("SELLER");

  const [productCount, activeProducts, activeOrders, completedOrders, recentOrders] = await Promise.all([
    prisma.product.count({ where: { sellerId: user.id } }),
    prisma.product.count({ where: { sellerId: user.id, status: ProductStatus.ACTIVE } }),
    prisma.order.count({
      where: {
        sellerId: user.id,
        status: { in: [OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.SHIPPED] },
      },
    }),
    prisma.order.count({ where: { sellerId: user.id, status: OrderStatus.COMPLETED } }),
    prisma.order.findMany({
      where: { sellerId: user.id },
      include: { product: true, buyer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Welcome back, {user.name}</h1>
        <Link href="/seller/products/new" className="btn-primary">+ Add product</Link>
      </div>

      <VerificationGate kind="seller" verified={user.sellerVerified} />

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Products" value={productCount} />
        <Stat label="Active products" value={activeProducts} />
        <Stat label="Active orders" value={activeOrders} />
        <Stat label="Completed orders" value={completedOrders} />
      </div>

      <section className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent orders</h2>
          <Link href="/seller/orders/active" className="text-sm text-brand-700 hover:underline">View all</Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-gray-500">No orders yet.</p>
        ) : (
          <ul className="divide-y">
            {recentOrders.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-3">
                <div>
                  <Link href={`/seller/orders/${o.id}`} className="font-medium hover:underline">
                    {o.product.name}
                  </Link>
                  <p className="text-xs text-gray-500">
                    {o.buyer.name} · {timeAgo(o.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium"><Price amount={o.totalPrice} /></p>
                  <span className="badge bg-gray-100 text-gray-700">{o.status}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
