import Link from "next/link";
import { prisma } from "@/lib/db";
import { Logo } from "@/components/Logo";
import { CodeEntryForm } from "./CodeEntryForm";

export const metadata = {
  title: "StreekMart — Confirm delivery",
};

// /deliver/[id]
//
// Dispatch-rider landing page. Public — no login required. The rider sees
// the buyer name + city + product, confirms it matches the doorstep, then
// keys the 4-character code the buyer hands them.
export default async function DeliverPage({ params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      buyer: { select: { name: true, city: true, region: true } },
      product: { select: { name: true } },
      seller: { select: { name: true } },
      completedAt: true,
    },
  });

  if (!order) {
    return (
      <div className="min-h-screen bg-ink-50 px-4 py-10">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-soft">
          <h1 className="font-display text-xl font-semibold">Order not found</h1>
          <p className="mt-2 text-sm text-ink-600">
            Double-check the QR / URL on the packing slip.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50 px-4 py-10">
      <div className="mx-auto max-w-md space-y-6">
        <Link href="/" className="flex items-center justify-center">
          <Logo size={32} />
        </Link>

        <div className="rounded-2xl bg-white p-6 shadow-soft">
          <h1 className="font-display text-xl font-semibold">Confirm delivery</h1>
          <p className="mt-1 text-sm text-ink-600">
            Hand over the package, ask the buyer for their 4-digit code, and key it in
            below.
          </p>

          <dl className="mt-4 space-y-2 rounded-xl bg-ink-50 p-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Buyer</dt>
              <dd className="font-medium">{order.buyer.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">City</dt>
              <dd className="font-medium">
                {order.buyer.city ?? "—"}
                {order.buyer.region ? `, ${order.buyer.region}` : ""}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Item</dt>
              <dd className="line-clamp-1 font-medium">{order.product.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">Seller</dt>
              <dd className="font-medium">{order.seller.name}</dd>
            </div>
          </dl>

          {order.status === "COMPLETED" ? (
            <div className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-accent">
              ✓ This order was already marked delivered
              {order.completedAt
                ? ` on ${new Date(order.completedAt).toLocaleString()}`
                : ""}
              .
            </div>
          ) : order.status === "CANCELLED" ? (
            <div className="mt-6 rounded-xl bg-burgundy-50 p-4 text-sm text-burgundy-700">
              This order was cancelled. Don&apos;t deliver.
            </div>
          ) : (
            <div className="mt-6">
              <CodeEntryForm orderId={order.id} />
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-ink-500">
          Codes never expire and are unique per order. If the buyer can&apos;t find theirs,
          ask them to open StreekMart → Orders.
        </p>
      </div>
    </div>
  );
}
