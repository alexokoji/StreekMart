import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { OrderStatus, ProductStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { getGatewaySelector } from "@/lib/gatewaySelector";
import { finalizePaidOrders } from "@/lib/orders";
import { resolveDeliveryQuote } from "@/lib/locationServer";
import { getServerCurrencyContext } from "@/lib/currencyServer";
import { CheckoutBodySchema } from "@/lib/schemas/checkout";

// POST /api/cart/checkout — converts cart items into Orders (one per
// seller×product) under a single payment group.
//
// Live payment gateway (KORAPAY_LIVE=1):
//   1. Create orders as PENDING with a shared `paymentReference`.
//   2. Call the gateway to initialize a checkout session and mint a checkout URL.
//   3. Return { redirectUrl } so the client can hand off to the gateway.
//   4. The webhook finalises everything when the gateway confirms the payment.
//
// Stub mode (default for dev):
//   1. Create orders as PENDING.
//   2. Immediately call finalizePaidOrders so the dev/UX flow still ends in
//      PAID without going through a real gateway.

export async function POST(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = CheckoutBodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Pay-on-delivery is only available to admin-approved trusted buyers
  // (Order.paymentMethod=ON_DELIVERY). Until the trust gate is rolled out,
  // every check fails closed — POD is effectively coming soon.
  if (parsed.data.paymentMethod === "ON_DELIVERY") {
    const me = await prisma.user.findUnique({
      where: { id: guard.session.sub },
      select: { trustedBuyer: true },
    });
    if (!me?.trustedBuyer) {
      return NextResponse.json(
        {
          error:
            "Pay on delivery is currently only available to trusted buyers. " +
            "Complete a few delivered orders first; we'll email you when it's enabled on your account.",
        },
        { status: 403 },
      );
    }
  }

  const buyer = await prisma.user.findUnique({
    where: { id: guard.session.sub },
    select: { country: true, city: true, region: true, phone: true, name: true },
  });
  if (!buyer?.country || !buyer.city) {
    return NextResponse.json(
      {
        error:
          "Add your country and city in Account settings before checking out — we use them to calculate delivery.",
      },
      { status: 400 },
    );
  }

  const cart = await prisma.cart.findUnique({
    where: { userId: guard.session.sub },
    include: {
      items: {
        include: {
          product: {
            include: {
              seller: {
                select: {
                  id: true,
                  country: true,
                  city: true,
                  region: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }

  const live = cart.items.filter((it) => it.product.status === ProductStatus.ACTIVE);
  if (live.length === 0) {
    return NextResponse.json(
      { error: "None of the items in your cart are available right now." },
      { status: 400 },
    );
  }

  // One reference per checkout group. Used by the webhook to find every
  // sibling order and finalise them together.
  const paymentReference = `UPCLO_${randomBytes(8).toString("hex").toUpperCase()}`;

  // Get current currency context to lock in today's exchange rate
  const currencyCtx = await getServerCurrencyContext();

  // Resolve a delivery quote for every distinct seller in the cart. We do
  // this BEFORE creating any Order rows so an international / unsupported-
  // city blocker rejects the whole checkout with a clean error instead of
  // half-creating PENDING rows.
  // Per-seller quote — the only outcome that can hard-reject is cross-
  // border (international). Fees on the quote are 0 placeholders; the real
  // courier price comes from the buyer's explicit `shippingChoices` (the
  // Shipbubble rates they picked in the checkout UI).
  const uniqueSellerIds = Array.from(new Set(live.map((it) => it.product.seller.id)));
  type Quote = { feeCents: number; zone: string; fulfiller: "PLATFORM" | "SELLER" };
  const quoteBySellerId = new Map<string, Quote>();
  for (const sellerId of uniqueSellerIds) {
    const seller = live.find((it) => it.product.seller.id === sellerId)!.product.seller;
    const quote = await resolveDeliveryQuote({
      buyer,
      seller,
      zoneOverride: parsed.data.zoneOverride,
    });
    if (quote.fulfiller === "BLOCKED") {
      return NextResponse.json(
        { error: quote.blockedReason ?? "Delivery isn't available for this seller." },
        { status: 400 },
      );
    }
    quoteBySellerId.set(sellerId, {
      feeCents: quote.feeCents,
      zone: quote.zone,
      fulfiller: quote.fulfiller,
    });
  }

  // If the buyer provided shipping choices (single or multi-seller), apply
  // the selected price to the per-seller quote so the buyer is charged what
  // they explicitly chose at checkout.
  if (parsed.data.shippingChoices && parsed.data.shippingChoices.length > 0) {
    for (const choice of parsed.data.shippingChoices) {
      const sid = choice.sellerId;
      if (!sid) continue;
      const q = quoteBySellerId.get(sid);
      if (q && choice.priceCents != null) q.feeCents = choice.priceCents;
    }
  }

  // Charge delivery once per seller in this checkout group — buying two
  // items from the same shop should be one shipment, not two. The first
  // order from each seller carries the full fee + fulfiller; the rest get
  // 0 and inherit the same fulfiller (kept on every row for analytics).
  const sellerSeen = new Set<string>();

  const orders = await prisma.$transaction(
    live.map((it) => {
      const unitPriceUsd = it.product.salePrice ?? it.product.price;
      const unitPrice = unitPriceUsd * currencyCtx.rate;
      const quote = quoteBySellerId.get(it.product.seller.id)!;
      const sellerKey = it.product.seller.id;
      const isFirstFromSeller = !sellerSeen.has(sellerKey);
      if (isFirstFromSeller) sellerSeen.add(sellerKey);
      const deliveryFeeCents = isFirstFromSeller ? quote.feeCents : 0;
      const itemTotal = unitPrice * it.quantity + deliveryFeeCents / 100;
      console.log("[checkout] item:", { productId: it.product.id, unitPriceUsd, unitPrice, currency: currencyCtx.code, qty: it.quantity, delivery: deliveryFeeCents, itemTotal });

      return prisma.order.create({
        data: {
          productId: it.product.id,
          buyerId: guard.session.sub,
          sellerId: it.product.sellerId,
          quantity: it.quantity,
          totalPrice: itemTotal,
          deliveryFeeCents,
          deliveryZone: quote.zone,
          deliveryFulfiller: quote.fulfiller,
          status: OrderStatus.PENDING,
          shippingAddress: parsed.data.shippingAddress,
          shippingFormattedAddress: parsed.data.shippingFormattedAddress,
          shippingLatitude: parsed.data.shippingLatitude,
          shippingLongitude: parsed.data.shippingLongitude,
          shippingPlaceId: parsed.data.shippingPlaceId,
          notes: parsed.data.notes,
          // Freeze the buyer's variant pick onto the order so seller-side
          // edits to the product's attribute spec later can't rewrite what
          // the buyer actually ordered.
          selectedAttributesJson: it.selectedAttributesJson ?? "{}",
          paymentMethod: parsed.data.paymentMethod,
          paymentReference,
        },
      });
    }),
  );

  const totalCents = Math.round(orders.reduce((s, o) => s + o.totalPrice, 0) * 100);

  // Buyer pays the full amount directly. Wallet is only for seller payouts and refunds.
  const remainingCents = totalCents;

  // If the wallet fully covers the order, finalise immediately. No gateway
  // hop, no live-mode check — the buyer already paid (with refund credit)
  // and the seller's held-funds flow kicks in just like a card payment.
  if (remainingCents === 0) {
    await finalizePaidOrders({
      paymentReference,
      paymentTxnRef: `WALLET_${paymentReference}`,
    });
    return NextResponse.json({
      ok: true,
      paymentReference,
      paidByWallet: true,
      orders: orders.map((o) => ({ id: o.id })),
    });
  }

  const gateway = getGatewaySelector();
  const isStubMode = gateway.isStubMode();

  // Persist shipping choices as ShippingRate snapshots linked to the
  // created orders so sellers see which option the buyer picked. Sellers
  // will create shipments themselves from the order page using these
  // selected rates. This does not create shipments during checkout.
  if (parsed.data.shippingChoices && parsed.data.shippingChoices.length > 0) {
    const choicesBySeller = new Map(parsed.data.shippingChoices.map((c: any) => [c.sellerId, c]));
    for (const ord of orders) {
      const choice = choicesBySeller.get(ord.sellerId);
      if (!choice) continue;
      try {
        await prisma.shippingRate.create({
          data: {
            orderId: ord.id,
            provider: choice.provider,
            courierName: choice.courierName || choice.courierId || "",
            amountCents: choice.priceCents ?? 0,
            estimatedDays: choice.estimatedDays ?? null,
            estimatedDeliveryAt: null,
            selected: true,
          },
        });
      } catch (err) {
        console.error("Failed to persist shipping rate for order", ord.id, err);
      }
    }
  }

  if (!isStubMode) {
    try {
      const gateway = getGatewaySelector();
      const txn = await gateway.initCheckout({
        amountCents: remainingCents,
        customerEmail: guard.session.email,
        customerName: guard.session.name,
        description: `StreekMart order × ${orders.length}`,
        paymentReference,
        redirectUrl: buildRedirectUrl(req, paymentReference),
      });
      return NextResponse.json({
        ok: true,
        paymentReference,
        redirectUrl: txn.checkoutUrl,
        orders: orders.map((o) => ({ id: o.id })),
      });
    } catch (err) {
      // If the gateway hand-off fails we cancel the freshly created orders
      // so the buyer can retry without ghost PENDING rows piling up.
      await prisma.order.updateMany({
        where: { paymentReference },
        data: { status: OrderStatus.CANCELLED },
      });
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Could not start payment." },
        { status: 502 },
      );
    }
  }

  // Stub mode: short-circuit straight through to PAID via the same helper
  // the webhook calls. Keeps the post-payment side effects in one place.
  await finalizePaidOrders({ paymentReference, paymentTxnRef: `STUB_${paymentReference}` });
  return NextResponse.json({
    ok: true,
    paymentReference,
    orders: orders.map((o) => ({ id: o.id })),
  });
}

function buildRedirectUrl(req: Request, paymentReference: string): string {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? new URL(req.url).origin;
  return `${origin}/cart/checkout/return?ref=${encodeURIComponent(paymentReference)}`;
}
