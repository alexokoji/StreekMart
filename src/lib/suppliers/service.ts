// Supplier sourcing service: owns the StreekMart "house" seller account,
// publishes supplier products as ordinary storefront listings, keeps cost /
// stock in sync, and routes paid customer orders to the supplier.
//
// Customer-facing surfaces only ever see the house account, so a shopper
// can't tell a listing is sourced externally.

import { prisma } from "@/lib/db";
import { ProductStatus } from "@/lib/enums";
import { isValidCategory, kindForCategoryAsync } from "@/lib/categories";
import { uniqueSlugFrom } from "@/lib/slug";
import { getAdapter, type CatalogItem } from "./adapters";
import { effectiveMarkup, sellPrice } from "./pricing";

export const HOUSE_EMAIL = "store@streekmart.internal";
const HOUSE_NAME = "StreekMart";

/** The seller account that owns every supplier-sourced listing. */
export async function getHouseSeller(): Promise<{ id: string }> {
  const existing = await prisma.user.findUnique({
    where: { email: HOUSE_EMAIL },
    select: { id: true },
  });
  if (existing) return existing;
  const slug = await uniqueSlugFrom("streekmart");
  return prisma.user.create({
    data: {
      email: HOUSE_EMAIL,
      // No password and a non-password provider: nobody can sign in as it.
      passwordHash: null,
      authProvider: "system",
      name: HOUSE_NAME,
      businessName: HOUSE_NAME,
      slug,
      isSeller: true,
      sellerVerified: true,
      sellerTier: 3,
      streekmartAffiliated: true,
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  });
}

type SupplierRow = {
  id: string;
  markupType: string;
  markupValue: number;
};
type SpRow = {
  id: string;
  costPrice: number;
  markupType: string | null;
  markupValue: number | null;
};

export function priceFor(supplier: SupplierRow, sp: SpRow): number {
  return sellPrice(sp.costPrice, effectiveMarkup(supplier, sp));
}

/**
 * Create or update the storefront Product for a supplier product.
 * Throws a user-readable Error when it can't be published.
 */
export async function publishSupplierProduct(spId: string) {
  const sp = await prisma.supplierProduct.findUnique({
    where: { id: spId },
    include: { supplier: true },
  });
  if (!sp) throw new Error("Product not found");
  if (!sp.supplier.active) throw new Error("Supplier is paused — re-activate it first");
  if (!(await isValidCategory(sp.category))) {
    throw new Error("Pick a valid StreekMart category before publishing");
  }
  const images = safeArray(sp.imagesJson);
  if (images.length === 0) throw new Error("Add at least one image before publishing");

  const house = await getHouseSeller();
  const price = priceFor(sp.supplier, sp);
  const status = sp.stock > 0 ? ProductStatus.ACTIVE : ProductStatus.SOLD_OUT;
  const common = {
    name: sp.name,
    description: sp.description || sp.name,
    price,
    category: sp.category,
    kind: await kindForCategoryAsync(sp.category),
    imagesJson: sp.imagesJson,
    stock: sp.stock,
    status,
  };

  let productId = sp.productId;
  if (productId) {
    await prisma.product.update({ where: { id: productId }, data: common });
  } else {
    const p = await prisma.product.create({ data: { ...common, sellerId: house.id } });
    productId = p.id;
  }
  await prisma.supplierProduct.update({
    where: { id: sp.id },
    data: { status: "PUBLISHED", productId },
  });
  return { productId, price };
}

/** Pull a supplier product off the storefront (listing kept, archived). */
export async function unpublishSupplierProduct(spId: string) {
  const sp = await prisma.supplierProduct.findUnique({ where: { id: spId } });
  if (!sp) throw new Error("Product not found");
  if (sp.productId) {
    await prisma.product.update({
      where: { id: sp.productId },
      data: { status: ProductStatus.ARCHIVED },
    });
  }
  await prisma.supplierProduct.update({ where: { id: sp.id }, data: { status: "HIDDEN" } });
}

/** Re-apply current cost/markup/stock to an already-published listing. */
export async function refreshListing(spId: string) {
  const sp = await prisma.supplierProduct.findUnique({
    where: { id: spId },
    include: { supplier: true },
  });
  if (!sp?.productId || sp.status !== "PUBLISHED") return;
  await prisma.product.update({
    where: { id: sp.productId },
    data: {
      price: priceFor(sp.supplier, sp),
      stock: sp.stock,
      status: sp.stock > 0 ? ProductStatus.ACTIVE : ProductStatus.SOLD_OUT,
    },
  });
}

/** Re-price every published product of a supplier (after a markup change). */
export async function refreshSupplierListings(supplierId: string) {
  const rows = await prisma.supplierProduct.findMany({
    where: { supplierId, status: "PUBLISHED" },
    select: { id: true },
  });
  for (const r of rows) await refreshListing(r.id);
}

/** Insert/update catalog rows. Returns counts. Never touches the storefront. */
export async function upsertCatalog(supplierId: string, items: CatalogItem[]) {
  let created = 0;
  let updated = 0;
  for (const it of items) {
    const existing = await prisma.supplierProduct.findUnique({
      where: { supplierId_externalId: { supplierId, externalId: it.externalId } },
    });
    const images = JSON.stringify(it.images ?? []);
    if (existing) {
      // A re-sync/re-import owns cost + stock. Everything an admin may have
      // curated (name, description, images, category) is only filled in when
      // still empty, so edits are never clobbered.
      await prisma.supplierProduct.update({
        where: { id: existing.id },
        data: {
          costPrice: it.costPrice,
          stock: it.stock ?? existing.stock,
          ...(!existing.description && it.description ? { description: it.description } : {}),
          ...(existing.imagesJson === "[]" && images !== "[]" ? { imagesJson: images } : {}),
          ...(!existing.category && it.category ? { category: it.category } : {}),
        },
      });
      await refreshListing(existing.id);
      updated++;
    } else {
      await prisma.supplierProduct.create({
        data: {
          supplierId,
          externalId: it.externalId,
          name: it.name,
          description: it.description ?? "",
          imagesJson: images,
          costPrice: it.costPrice,
          stock: it.stock ?? 0,
          category: it.category ?? "",
        },
      });
      created++;
    }
  }
  return { created, updated };
}

/** Pull the supplier's catalog through its API adapter. */
export async function syncSupplier(supplierId: string) {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) throw new Error("Supplier not found");
  const adapter = getAdapter(supplier);
  if (!adapter) throw new Error("This supplier is manual — it has no API to sync");
  try {
    const cat = await adapter.fetchCatalog();
    const r = await upsertCatalog(supplier.id, cat.items);
    // Items we know about that the supplier no longer lists are treated as
    // out of stock (and pulled from sale via refreshListing). Only when we
    // saw the WHOLE catalog and it wasn't empty — a partial or blank
    // response must never wipe our stock.
    let gone = 0;
    if (cat.complete && cat.items.length > 0) {
      const missing = await prisma.supplierProduct.findMany({
        where: {
          supplierId: supplier.id,
          stock: { gt: 0 },
          externalId: { notIn: cat.items.map((i) => i.externalId) },
          NOT: { externalId: { startsWith: "manual:" } },
        },
        select: { id: true },
      });
      for (const m of missing) {
        await prisma.supplierProduct.update({ where: { id: m.id }, data: { stock: 0 } });
        await refreshListing(m.id);
        gone++;
      }
    }
    const note =
      `Synced ${cat.items.length} items (${r.created} new, ${r.updated} updated` +
      `${gone ? `, ${gone} no longer listed` : ""}` +
      `${cat.skipped.length ? `, ${cat.skipped.length}+ skipped` : ""})` +
      `${cat.complete ? "" : " — partial"}`;
    await prisma.supplier.update({
      where: { id: supplier.id },
      data: { lastSyncAt: new Date(), lastSyncNote: note },
    });
    return { ...r, total: cat.items.length, gone, skipped: cat.skipped, complete: cat.complete };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    await prisma.supplier.update({
      where: { id: supplier.id },
      data: { lastSyncAt: new Date(), lastSyncNote: `Failed: ${msg.slice(0, 200)}` },
    });
    throw e;
  }
}

/**
 * Poll API suppliers for status/tracking of orders they've accepted.
 * Returns how many orders changed. Errors on one order never stop the rest.
 */
export async function syncSupplierOrders() {
  const open = await prisma.supplierOrder.findMany({
    where: {
      status: { in: ["PLACED", "SHIPPED"] },
      externalOrderId: { not: null },
      supplier: { integration: "API", active: true },
    },
    include: { supplier: true },
    take: 200,
  });
  let changed = 0;
  let failed = 0;
  for (const so of open) {
    const adapter = getAdapter(so.supplier);
    if (!adapter) continue;
    try {
      const r = await adapter.getOrderStatus(so.externalOrderId!);
      if (!r) continue;
      const nextStatus = r.status ?? so.status;
      const tracking = r.trackingCode ?? so.trackingCode;
      if (nextStatus !== so.status || tracking !== so.trackingCode) {
        await prisma.supplierOrder.update({
          where: { id: so.id },
          data: { status: nextStatus, trackingCode: tracking },
        });
        changed++;
      }
    } catch (e) {
      failed++;
      console.error("[suppliers] order status poll failed", so.id, (e as Error).message);
    }
  }
  return { checked: open.length, changed, failed };
}

/**
 * Called after customer orders are paid. Creates a SupplierOrder for every
 * order whose product is supplier-sourced and, for API suppliers, tries to
 * place it immediately. Idempotent per order. Never throws — a failure here
 * must not undo the customer's payment; it surfaces in the admin queue.
 */
export async function routeOrdersToSuppliers(orderIds: string[]) {
  try {
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds }, supplierOrder: null, product: { supplierProduct: { isNot: null } } },
      include: {
        product: { include: { supplierProduct: true } },
        buyer: { select: { name: true, phone: true } },
      },
    });
    for (const o of orders) {
      const sp = o.product.supplierProduct;
      if (!sp) continue;
      const so = await prisma.supplierOrder
        .create({
          data: {
            orderId: o.id,
            supplierId: sp.supplierId,
            supplierProductId: sp.id,
            quantity: o.quantity,
            unitCost: sp.costPrice,
            totalCost: sp.costPrice * o.quantity,
            revenue: o.totalPrice - o.deliveryFeeCents / 100,
          },
        })
        .catch(() => null); // unique race → someone else created it
      if (!so) continue;
      // Reserve stock so we don't oversell between syncs (manual suppliers
      // especially). refreshListing flips the listing to SOLD_OUT at zero.
      await prisma.supplierProduct.update({
        where: { id: sp.id },
        data: { stock: Math.max(0, sp.stock - Math.ceil(o.quantity)) },
      });
      await refreshListing(sp.id);
      await placeSupplierOrder(so.id);
    }
  } catch (err) {
    console.error("[suppliers] routeOrdersToSuppliers failed", err);
  }
}

/** Try to place a TO_PLACE / FAILED supplier order through the API. */
export async function placeSupplierOrder(supplierOrderId: string) {
  const so = await prisma.supplierOrder.findUnique({
    where: { id: supplierOrderId },
    include: {
      supplier: true,
      supplierProduct: true,
      order: { include: { buyer: { select: { name: true, phone: true } } } },
    },
  });
  if (!so) throw new Error("Supplier order not found");
  const adapter = getAdapter(so.supplier);
  if (!adapter) return so; // manual supplier: stays TO_PLACE for the admin
  try {
    const r = await adapter.placeOrder({
      reference: so.id,
      sku: so.supplierProduct.externalId,
      quantity: so.quantity,
      unitCost: so.unitCost,
      recipient: {
        name: so.order.buyer.name,
        phone: so.order.buyer.phone,
        address: so.order.shippingFormattedAddress ?? so.order.shippingAddress ?? "",
      },
    });
    return prisma.supplierOrder.update({
      where: { id: so.id },
      data: {
        status: "PLACED",
        externalOrderId: r.externalOrderId,
        trackingCode: r.trackingCode ?? so.trackingCode,
        error: null,
      },
    });
  } catch (e) {
    return prisma.supplierOrder.update({
      where: { id: so.id },
      data: { status: "FAILED", error: e instanceof Error ? e.message.slice(0, 300) : "Failed" },
    });
  }
}

export function safeArray(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
