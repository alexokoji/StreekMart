import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { displaySellerName } from "@/lib/businessName";
import { parseJsonArray, timeAgo } from "@/lib/utils";
import { Price } from "@/components/Price";
import { deliveryZoneLabel, type DeliveryZone } from "@/lib/location";
import { SellerRatingForm } from "@/components/orders/SellerRatingForm";

// /account/orders/[id]
//
// Single-order detail. Same-city orders get the most utility here: live
// tracking timeline updated by the seller, delivery code for the rider, and
// ETA when supplied.
export default async function BuyerOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      product: { select: { id: true, name: true, imagesJson: true } },
      seller: {
        select: {
          id: true,
          slug: true,
          name: true,
          businessName: true,
          // Surfaced to the buyer once payment is confirmed so they can
          // reach the seller about delivery questions, sizing follow-ups,
          // missed door deliveries, etc.
          phone: true,
          city: true,
          country: true,
        },
      },
      updates: { orderBy: { createdAt: "asc" } },
      sellerReview: true,
    },
  });

  if (!order || order.buyerId !== user.id) notFound();

  const cover = parseJsonArray(order.product.imagesJson)[0] ?? null;
  const handle = order.seller.slug ?? order.seller.id;

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/account/orders"
          className="text-xs text-violet-700 hover:underline"
        >
          ← Back to orders
        </Link>
        <h1 className="mt-1 font-display text-2xl font-bold">{order.product.name}</h1>
        <p className="text-sm text-ink-600">
          Sold by{" "}
          <Link href={`/u/${handle}`} className="text-violet-700 hover:underline">
            {displaySellerName(order.seller)}
          </Link>
          {" · "}
          {timeAgo(order.createdAt)}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <section className="card flex gap-4 p-4">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-ink-100">
              {cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt={order.product.name} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">
                {order.quantity} × <Price amount={order.totalPrice - order.deliveryFeeCents / 100} />
              </p>
              <p className="mt-0.5 text-xs text-ink-500">
                Delivery ({deliveryZoneLabel(order.deliveryZone as DeliveryZone)}):{" "}
                <Price amount={order.deliveryFeeCents / 100} />
              </p>
              <p className="mt-2 text-sm font-semibold">
                Total <Price amount={order.totalPrice} />
              </p>
              <span className="mt-2 inline-block rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-ink-700">
                {order.status}
              </span>
            </div>
          </section>

          <Timeline
            createdAt={order.createdAt}
            paidAt={order.paidAt}
            expectedDeliveryBy={order.expectedDeliveryBy}
            completedAt={order.completedAt}
            updates={order.updates.map((u) => ({
              id: u.id,
              kind: u.kind,
              message: u.message,
              etaAt: u.etaAt?.toISOString() ?? null,
              createdAt: u.createdAt.toISOString(),
            }))}
            status={order.status}
          />

          {order.status === "COMPLETED" && (
            <SellerRatingForm
              orderId={order.id}
              sellerName={displaySellerName(order.seller)}
              completedAt={(order.completedAt ?? order.updatedAt).toISOString()}
              existing={
                order.sellerReview
                  ? {
                      rating: order.sellerReview.rating,
                      body: order.sellerReview.body,
                      edited: order.sellerReview.edited,
                    }
                  : null
              }
            />
          )}
        </div>

        <aside className="space-y-4">
          {/* Delivery code card — only meaningful while the order is in flight. */}
          {order.deliveryCode &&
            (order.status === "PAID" || order.status === "SHIPPED") && (
              <section className="card border-violet-200 bg-violet-50/40 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-700">
                  Delivery code
                </p>
                <p className="mt-2 font-mono text-3xl font-bold tracking-[0.5em] text-ink-900">
                  {order.deliveryCode}
                </p>
                <p className="mt-2 text-xs text-ink-600">
                  Share with the dispatch rider when they arrive. They&apos;ll key it
                  in to mark your order delivered.
                </p>
              </section>
            )}

          <section className="card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">
              Shipping to
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm">
              {order.shippingAddress ?? "—"}
            </p>
          </section>

          <section className="card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">
              Ships from
            </p>
            <p className="mt-2 text-sm">
              {order.seller.city ?? "—"}
              {order.seller.country ? `, ${order.seller.country}` : ""}
            </p>
          </section>

          {/* Direct line to the seller, surfaced once payment is real.
              Hidden on PENDING so an abandoned checkout doesn't leak the
              seller's number. */}
          {order.status !== "PENDING" && (
            <section className="card p-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">
                Contact seller
              </p>
              {order.seller.phone ? (
                <a
                  href={`tel:${order.seller.phone.replace(/\s+/g, "")}`}
                  className="mt-2 inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 font-medium text-violet-800 hover:bg-violet-100"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  {order.seller.phone}
                </a>
              ) : (
                <p className="mt-2 text-xs text-ink-500">
                  Seller hasn&apos;t added a phone number yet.
                </p>
              )}
              <Link
                href={`/messages?with=${order.seller.id}`}
                className="mt-2 inline-block text-xs text-violet-700 hover:underline"
              >
                Or message them on StreekMart →
              </Link>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Timeline({
  createdAt,
  paidAt,
  expectedDeliveryBy,
  completedAt,
  updates,
  status,
}: {
  createdAt: Date;
  paidAt: Date | null;
  expectedDeliveryBy: Date | null;
  completedAt: Date | null;
  updates: { id: string; kind: string; message: string; etaAt: string | null; createdAt: string }[];
  status: string;
}) {
  // Backbone events synthesised from the order itself — placed/paid/expected/
  // delivered — interleaved with the seller's freeform OrderUpdate rows.
  type Row = { ts: number; label: string; sub?: string; tone: "neutral" | "good" | "warn" };
  const rows: Row[] = [];
  rows.push({ ts: createdAt.getTime(), label: "Order placed", tone: "neutral" });
  if (paidAt) rows.push({ ts: paidAt.getTime(), label: "Payment confirmed", tone: "good" });
  for (const u of updates) {
    rows.push({
      ts: new Date(u.createdAt).getTime(),
      label: prettyKind(u.kind),
      sub:
        u.etaAt && (u.kind === "DISPATCHED" || u.kind === "ARRIVING")
          ? `${u.message} · ETA ${new Date(u.etaAt).toLocaleString()}`
          : u.message,
      tone: "neutral",
    });
  }
  if (expectedDeliveryBy && !completedAt) {
    rows.push({
      ts: expectedDeliveryBy.getTime(),
      label: `Expected by ${expectedDeliveryBy.toLocaleDateString()}`,
      tone: Date.now() > expectedDeliveryBy.getTime() ? "warn" : "neutral",
    });
  }
  if (completedAt) {
    rows.push({ ts: completedAt.getTime(), label: "Delivered ✓", tone: "good" });
  }
  rows.sort((a, b) => a.ts - b.ts);

  return (
    <section className="card p-6">
      <h2 className="font-display text-lg font-semibold">Tracking</h2>
      <p className="text-xs text-ink-500">
        Updates from the seller appear here as your order moves toward you.
      </p>
      <ol className="mt-5 space-y-4">
        {rows.map((r, i) => (
          <li key={i} className="flex gap-3">
            <span
              className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                r.tone === "good"
                  ? "bg-emerald-accent"
                  : r.tone === "warn"
                  ? "bg-amber-500"
                  : "bg-ink-300"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{r.label}</p>
              {r.sub && <p className="text-xs text-ink-600">{r.sub}</p>}
              <p className="text-[11px] text-ink-500">
                {new Date(r.ts).toLocaleString()}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {!completedAt && rows.length <= 2 && (
        <p className="mt-4 text-xs text-ink-500">
          Waiting on the seller to add a tracking update. Current status:{" "}
          <span className="font-medium">{status}</span>.
        </p>
      )}
    </section>
  );
}

function prettyKind(kind: string): string {
  switch (kind) {
    case "STATUS":
      return "Status update";
    case "DISPATCHED":
      return "Out for delivery";
    case "ARRIVING":
      return "Arriving soon";
    case "NOTE":
      return "Note from seller";
    default:
      return kind;
  }
}
