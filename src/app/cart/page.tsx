import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { displaySellerName } from "@/lib/businessName";
import { parseJsonArray } from "@/lib/utils";
import { Price } from "@/components/Price";
import {
  deliveryFeeCentsFor,
  deliveryZoneFor,
  deliveryZoneLabel,
  type DeliveryZone,
} from "@/lib/location";
import { CartClient } from "./CartClient";
import { DeliveryZonePicker } from "./DeliveryZonePicker";

// Page is dynamic — reads cookies (for auth) and searchParams. Mark
// explicit so Next never tries to cache an old quote on us.
export const dynamic = "force-dynamic";

export default async function CartPage({
  searchParams,
}: {
  // `?zone=within` or `?zone=outside` forces a manual override for the
  // delivery-zone calculation. Absent → auto-detect from saved address.
  searchParams: { zone?: string };
}) {
  const user = await requireUser();
  const zoneOverride: "WITHIN_CITY" | "OUTSIDE_CITY" | undefined =
    searchParams.zone === "within"
      ? "WITHIN_CITY"
      : searchParams.zone === "outside"
        ? "OUTSIDE_CITY"
        : undefined;

  // Lazy provision the cart on first visit.
  const cart = await prisma.cart.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
    include: {
      items: {
        include: {
          product: {
            include: {
              seller: {
                select: {
                  id: true,
                  name: true,
                  businessName: true,
                  country: true,
                  city: true,
                  region: true,
                  deliveryWithinCityCents: true,
                  deliveryOutsideCityCents: true,
                  deliveryOutsideCountryCents: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const items = cart.items.map((it) => ({
    id: it.id,
    quantity: it.quantity,
    product: {
      id: it.product.id,
      name: it.product.name,
      price: it.product.price,
      salePrice: it.product.salePrice,
      effectivePrice: it.product.salePrice ?? it.product.price,
      image: parseJsonArray(it.product.imagesJson)[0] ?? null,
      seller: it.product.seller,
      stock: it.product.stock,
      unit: it.product.unit,
    },
  }));

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl card p-10 text-center">
        <h1 className="text-2xl font-bold">Your cart is empty.</h1>
        <p className="mt-1 text-sm text-gray-600">
          Browse the storefront and add a few pieces to get started.
        </p>
        <Link href="/" className="btn-primary mt-6 inline-flex">
          Continue shopping
        </Link>
      </div>
    );
  }

  const subtotal = items.reduce((s, it) => s + it.product.effectivePrice * it.quantity, 0);

  // Delivery preview — same per-seller bundling rule the checkout endpoint
  // applies. Only computed when the buyer has filled in their address (or
  // an explicit zone override is set).
  const buyer = { country: user.country, city: user.city, region: user.region };
  const buyerHasAddress = !!buyer.country && !!buyer.city;
  const deliverySellerSeen = new Set<string>();
  type DeliveryLine = { sellerName: string; zoneLabel: string; cents: number };
  const deliveryBreakdown: DeliveryLine[] = [];
  if (buyerHasAddress) {
    for (const it of cart.items) {
      const sellerId = it.product.seller.id;
      if (deliverySellerSeen.has(sellerId)) continue;
      deliverySellerSeen.add(sellerId);
      // If the buyer picked an override, honour it. International is always
      // determined by country and ignores the override.
      const autoZone = deliveryZoneFor(buyer, it.product.seller);
      const zone: DeliveryZone =
        autoZone === "OUTSIDE_COUNTRY"
          ? "OUTSIDE_COUNTRY"
          : zoneOverride ?? autoZone;
      const cents = deliveryFeeCentsFor(it.product.seller, zone);
      deliveryBreakdown.push({
        sellerName: displaySellerName(it.product.seller),
        zoneLabel: deliveryZoneLabel(zone),
        cents,
      });
    }
  }
  const deliveryTotalCents = deliveryBreakdown.reduce((s, d) => s + d.cents, 0);
  const grandTotal = subtotal + deliveryTotalCents / 100;

  return (
    // `min-w-0` on both grid children defeats the default `min-width: auto`
    // so a long product name or business name can't push the cell past the
    // viewport. Without these, the CartClient's product titles or the
    // delivery breakdown's seller names cause horizontal page scroll.
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="min-w-0 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Your cart</h1>
          <p className="text-sm text-gray-500">{items.length} item{items.length === 1 ? "" : "s"}</p>
        </div>
        <CartClient items={items} />
      </div>

      <aside className="card sticky top-4 h-fit min-w-0 p-6">
        <h2 className="text-lg font-semibold">Order summary</h2>

        {/* Buyer-driven zone override — re-renders the breakdown below. */}
        <div className="mt-4">
          <DeliveryZonePicker
            current={
              zoneOverride === "WITHIN_CITY"
                ? "WITHIN_CITY"
                : zoneOverride === "OUTSIDE_CITY"
                  ? "OUTSIDE_CITY"
                  : "AUTO"
            }
          />
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt>Subtotal</dt>
            <dd className="font-medium"><Price amount={subtotal} /></dd>
          </div>

          {buyerHasAddress ? (
            deliveryBreakdown.length > 0 ? (
              <div className="border-t pt-2">
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">
                  Delivery
                </p>
                {deliveryBreakdown.map((d) => (
                  <div key={d.sellerName} className="flex justify-between gap-3">
                    {/* `min-w-0 break-words` lets long business names wrap
                        instead of widening the sticky aside past 22rem. */}
                    <dt className="min-w-0 break-words text-gray-600">
                      {d.sellerName}
                      <span className="ml-1 text-[10px] text-gray-400">· {d.zoneLabel}</span>
                    </dt>
                    <dd className="shrink-0">{d.cents > 0 ? <Price amount={d.cents / 100} /> : "Free"}</dd>
                  </div>
                ))}
              </div>
            ) : null
          ) : (
            <div className="flex justify-between text-gray-500">
              <dt>Delivery</dt>
              <dd className="text-right">
                <Link href="/account/settings" className="text-violet-700 hover:underline">
                  Add address →
                </Link>
              </dd>
            </div>
          )}

          <div className="mt-3 flex justify-between border-t pt-3 text-base">
            <dt className="font-semibold">{buyerHasAddress ? "Total" : "Subtotal so far"}</dt>
            <dd className="font-bold"><Price amount={grandTotal} /></dd>
          </div>
        </dl>
        {/* Carry the zone override through to checkout so the quote the
            checkout endpoint computes matches what the buyer saw here. */}
        <Link
          href={
            zoneOverride
              ? `/cart/checkout?zone=${zoneOverride === "WITHIN_CITY" ? "within" : "outside"}`
              : "/cart/checkout"
          }
          className="btn-primary mt-6 w-full text-center"
        >
          Checkout
        </Link>
        <Link href="/" className="mt-2 block text-center text-xs text-gray-500 hover:text-brand-700">
          Continue shopping
        </Link>
      </aside>
    </div>
  );
}
