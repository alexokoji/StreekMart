import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import { readActiveCategoryNames } from "@/lib/categories";
import { safeArray } from "@/lib/suppliers/service";
import { SuppliersPanel } from "./SuppliersPanel";
import { ProductsPanel } from "./ProductsPanel";
import { OrdersPanel } from "./OrdersPanel";

// /admin/suppliers — "Suppliers and Products". Everything about sourcing
// lives here: suppliers + markups, the sourced catalog, and the queue of
// customer orders we owe a supplier. Customers never see any of it.
export const dynamic = "force-dynamic";

const money = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

export default async function AdminSuppliersPage({
  searchParams,
}: {
  searchParams: { tab?: string; q?: string; supplier?: string; status?: string };
}) {
  await requireAdmin(ADMIN_PERMISSIONS.MANAGE_SUPPLIERS);
  const tab = ["products", "orders"].includes(searchParams.tab ?? "") ? searchParams.tab! : "suppliers";
  const q = (searchParams.q ?? "").trim();
  const supplierFilter = searchParams.supplier ?? "";
  const status = searchParams.status ?? "";

  const [suppliers, orderAgg, openOrders] = await Promise.all([
    prisma.supplier.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { products: true, orders: true } } },
    }),
    prisma.supplierOrder.groupBy({
      by: ["supplierId"],
      where: { status: { not: "CANCELLED" } },
      _sum: { totalCost: true, revenue: true },
    }),
    prisma.supplierOrder.count({ where: { status: { in: ["TO_PLACE", "FAILED"] } } }),
  ]);
  const liveCounts = await prisma.supplierProduct.groupBy({
    by: ["supplierId"],
    where: { status: "PUBLISHED" },
    _count: { _all: true },
  });
  const live = new Map(liveCounts.map((l) => [l.supplierId, l._count._all]));
  const agg = new Map(orderAgg.map((a) => [a.supplierId, a._sum]));
  const totalProfit = orderAgg.reduce((t, a) => t + ((a._sum.revenue ?? 0) - (a._sum.totalCost ?? 0)), 0);

  const tabs = [
    { key: "suppliers", label: "Suppliers" },
    { key: "products", label: "Products" },
    { key: "orders", label: `Orders${openOrders ? ` (${openOrders})` : ""}` },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Suppliers and Products</h1>
          <p className="text-sm text-ink-600">
            Source products from suppliers and sell them as StreekMart. Profit to date: <b>{money(totalProfit)}</b>
            {openOrders > 0 && <> · <b>{openOrders}</b> order{openOrders > 1 ? "s" : ""} waiting on you</>}
          </p>
        </div>
      </div>

      <nav className="flex gap-1 border-b border-ink-100">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/suppliers?tab=${t.key}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.key ? "border-ink-900 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "suppliers" && (
        <SuppliersPanel
          suppliers={suppliers.map((s) => {
            const a = agg.get(s.id);
            return {
              id: s.id,
              name: s.name,
              integration: s.integration === "API" ? "API" : "MANUAL",
              apiBaseUrl: s.apiBaseUrl,
              hasApiKey: !!s.apiKey,
              contactName: s.contactName,
              contactEmail: s.contactEmail,
              contactPhone: s.contactPhone,
              notes: s.notes,
              markupType: s.markupType === "FIXED" ? "FIXED" : "PERCENT",
              markupValue: s.markupValue,
              active: s.active,
              lastSyncAt: s.lastSyncAt?.toISOString() ?? null,
              lastSyncNote: s.lastSyncNote,
              productCount: s._count.products,
              liveCount: live.get(s.id) ?? 0,
              orderCount: s._count.orders,
              profit: (a?.revenue ?? 0) - (a?.totalCost ?? 0),
            };
          })}
        />
      )}

      {tab === "products" && (await ProductsTab({ q, supplierFilter, status, suppliers }))}
      {tab === "orders" && (await OrdersTab({ status }))}
    </div>
  );
}

async function ProductsTab({
  q,
  supplierFilter,
  status,
  suppliers,
}: {
  q: string;
  supplierFilter: string;
  status: string;
  suppliers: { id: string; name: string; markupType: string; markupValue: number }[];
}) {
  const [rows, categories] = await Promise.all([
    prisma.supplierProduct.findMany({
      where: {
        ...(supplierFilter ? { supplierId: supplierFilter } : {}),
        ...(status ? { status } : {}),
        ...(q ? { name: { contains: q } } : {}),
      },
      include: { supplier: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    readActiveCategoryNames(),
  ]);
  return (
    <ProductsPanel
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, markupType: s.markupType, markupValue: s.markupValue }))}
      categories={categories}
      filters={{ supplier: supplierFilter, status, q }}
      products={rows.map((p) => {
        const imgs = safeArray(p.imagesJson);
        return {
          id: p.id,
          supplierId: p.supplierId,
          supplierName: p.supplier.name,
          name: p.name,
          image: imgs[0] ?? null,
          imagesCsv: imgs.join(", "),
          category: p.category,
          costPrice: p.costPrice,
          stock: p.stock,
          status: (["PUBLISHED", "HIDDEN"].includes(p.status) ? p.status : "IMPORTED") as "IMPORTED" | "PUBLISHED" | "HIDDEN",
          markupType: p.markupType,
          markupValue: p.markupValue,
          productId: p.productId,
          supplierMarkupType: p.supplier.markupType,
          supplierMarkupValue: p.supplier.markupValue,
        };
      })}
    />
  );
}

async function OrdersTab({ status }: { status: string }) {
  const rows = await prisma.supplierOrder.findMany({
    where: status ? { status } : {},
    include: {
      supplier: { select: { name: true, integration: true } },
      supplierProduct: { select: { name: true } },
      order: {
        select: {
          shippingFormattedAddress: true,
          shippingAddress: true,
          buyer: { select: { name: true, phone: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <OrdersPanel
      status={status}
      orders={rows.map((o) => ({
        id: o.id,
        orderId: o.orderId,
        supplierName: o.supplier.name,
        integration: o.supplier.integration,
        productName: o.supplierProduct.name,
        quantity: o.quantity,
        totalCost: o.totalCost,
        revenue: o.revenue,
        status: o.status,
        externalOrderId: o.externalOrderId,
        trackingCode: o.trackingCode,
        error: o.error,
        recipient: [o.order.buyer.name, o.order.buyer.phone].filter(Boolean).join(" · "),
        address: o.order.shippingFormattedAddress ?? o.order.shippingAddress ?? "",
        createdAt: o.createdAt.toISOString(),
      }))}
    />
  );
}
