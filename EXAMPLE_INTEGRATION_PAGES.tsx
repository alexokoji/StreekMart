// Example: src/app/(app)/seller/orders/page.tsx
// Shows how to integrate ShipmentGenerationCard into seller dashboard

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Permission } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { ShipmentGenerationCard } from "@/components/seller/ShipmentGenerationCard";

export default async function SellerOrdersPage() {
  // Protect page — only sellers can access
  const user = await requireUser(Permission.SELLER);

  // Fetch seller's orders
  const orders = await prisma.order.findMany({
    where: { sellerId: user.id },
    include: {
      product: { select: { name: true } },
      buyer: { select: { name: true, phone: true, city: true } },
      shipment: { select: { id: true, trackingCode: true, status: true, labelUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
        <p className="mt-2 text-gray-600">Manage your orders and create shipments</p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <p className="text-gray-600">No orders yet</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <ShipmentGenerationCard
              key={order.id}
              order={order}
              onShipmentCreated={() => {
                // Optionally refresh the page or refetch orders
                // window.location.reload();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Example: src/app/(app)/buyer/orders/[id]/page.tsx
// Shows how to integrate ShipmentTracker into buyer order detail page

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ShipmentTracker } from "@/components/buyer/ShipmentTracker";

interface PageProps {
  params: { id: string };
}

export default async function BuyerOrderDetailPage({ params }: PageProps) {
  const user = await requireUser(); // Any logged-in user

  // Fetch order
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      product: { select: { name: true, price: true, imagesJson: true } },
      buyer: { select: { id: true } },
      seller: { select: { id: true, businessName: true, name: true } },
      shipment: { select: { id: true, trackingCode: true, status: true } },
      updates: { orderBy: { createdAt: "desc" }, select: { kind: true, message: true, createdAt: true } },
    },
  });

  // Verify buyer owns this order
  if (!order || order.buyer.id !== user?.id) {
    notFound();
  }

  const images = JSON.parse(order.product.imagesJson || "[]");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl p-6">
        {/* Order Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Order #{order.id.slice(0, 8)}</h1>
          <p className="mt-2 text-gray-600">
            {new Date(order.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="space-y-8">
          {/* Product Info */}
          <section className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">Product</h2>
            <div className="mt-4 space-y-2">
              <p className="text-lg font-medium text-gray-900">{order.product.name}</p>
              <p className="text-gray-600">Quantity: {order.quantity}</p>
              <p className="text-gray-600">Price: ${order.product.price.toFixed(2)}</p>
              <p className="text-gray-600">From: {order.seller.businessName || order.seller.name}</p>
            </div>
          </section>

          {/* Shipment Tracking */}
          {order.shipment ? (
            <section className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900">Track Your Shipment</h2>
              <div className="mt-4">
                <ShipmentTracker orderId={order.id} trackingCode={order.shipment.trackingCode} />
              </div>
            </section>
          ) : (
            <section className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
              <p className="text-sm text-yellow-800">
                ⏳ Waiting for seller to generate shipment. You'll be notified once it ships.
              </p>
            </section>
          )}

          {/* Order Updates Timeline */}
          {order.updates.length > 0 && (
            <section className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900">Order Updates</h2>
              <div className="mt-4 space-y-4">
                {order.updates.map((update, idx) => (
                  <div
                    key={idx}
                    className="border-l-4 border-blue-400 pl-4"
                  >
                    <p className="font-medium text-gray-900">{update.message}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(update.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Order Status */}
          <section className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">Order Status</h2>
            <div className="mt-4">
              <span className="inline-block rounded-full bg-blue-100 px-4 py-2 text-sm font-medium text-blue-800">
                {order.status}
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Example: src/app/admin/logistics/page.tsx
// Shows how to build admin logistics dashboard

import { requireAdmin } from "@/lib/auth";
import {
  getShippingStats,
  getFailedDeliveries,
  getProblematicShipments,
  getAverageDeliveryTime,
} from "@/lib/integrationHelpers";

export default async function AdminLogisticsPage() {
  const user = await requireAdmin(); // Admin only

  // Fetch all metrics in parallel
  const [stats, avgDelivery, failedDeliveries, problematic] = await Promise.all([
    getShippingStats({ days: 30 }),
    getAverageDeliveryTime({ days: 30 }),
    getFailedDeliveries({ limit: 10 }),
    getProblematicShipments(),
  ]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Logistics Dashboard</h1>
          <p className="mt-2 text-gray-600">Last 30 days</p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard label="Total Shipments" value={stats.total} />
          <MetricCard label="Delivered" value={stats.delivered} />
          <MetricCard label="In Transit" value={stats.inTransit} />
          <MetricCard label="Failed" value={stats.failed} highlight="danger" />
        </div>

        {/* Success Rate & Avg Delivery */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <p className="text-sm font-medium text-gray-600">Success Rate</p>
            <p className="mt-2 text-3xl font-bold text-green-600">{stats.successRate}%</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <p className="text-sm font-medium text-gray-600">Avg Delivery Time</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {avgDelivery ? `${avgDelivery} days` : "N/A"}
            </p>
          </div>
        </div>

        {/* By Provider */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">Shipments by Provider</h2>
          <div className="mt-4 space-y-2">
            {stats.byProvider.map((p) => (
              <div key={p.provider} className="flex justify-between">
                <span className="text-gray-700">{p.provider}</span>
                <span className="font-semibold text-gray-900">{p.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Failed Deliveries */}
        {failedDeliveries.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6">
            <h2 className="text-lg font-semibold text-red-900">Failed Deliveries</h2>
            <div className="mt-4 space-y-4">
              {failedDeliveries.map((shipment) => (
                <div key={shipment.id} className="rounded bg-white p-3 text-sm">
                  <p className="font-medium text-gray-900">
                    Order #{shipment.order.id.slice(0, 8)}
                  </p>
                  <p className="text-gray-600">Buyer: {shipment.order.buyer?.name}</p>
                  <p className="text-gray-600">Phone: {shipment.order.buyer?.phone}</p>
                  <p className="mt-1 text-gray-500">
                    {new Date(shipment.updatedAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Problematic Shipments */}
        {problematic.length > 0 && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
            <h2 className="text-lg font-semibold text-yellow-900">Needs Attention</h2>
            <div className="mt-4 space-y-4">
              {problematic.map((shipment) => (
                <div key={shipment.id} className="rounded bg-white p-3 text-sm">
                  <div className="flex justify-between">
                    <p className="font-medium text-gray-900">
                      Order #{shipment.order.id.slice(0, 8)}
                    </p>
                    <span className="rounded bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                      {shipment.status}
                    </span>
                  </div>
                  <p className="mt-1 text-gray-600">
                    Created: {new Date(shipment.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper component
function MetricCard({ label, value, highlight }: { label: string; value: number; highlight?: string }) {
  const bgColor = highlight === "danger" ? "bg-red-50" : "bg-blue-50";
  const textColor = highlight === "danger" ? "text-red-600" : "text-blue-600";

  return (
    <div className={`rounded-lg border border-gray-200 ${bgColor} p-6`}>
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${textColor}`}>{value}</p>
    </div>
  );
}
