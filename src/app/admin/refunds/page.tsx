import Link from "next/link";
import { OrderStatus } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Price } from "@/components/Price";
import { timeAgo } from "@/lib/utils";

// /admin/refunds — two views in one page:
//   1. Orders past their delivery window that the buyer is eligible to cancel.
//   2. Recent REFUND ledger entries (admin sanity check on auto-credits).
export default async function AdminRefundsPage() {
  await requireAdmin();
  const now = new Date();

  const [stuckOrders, recentRefunds] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.PAID, OrderStatus.SHIPPED] },
        expectedDeliveryBy: { lte: now },
      },
      orderBy: { expectedDeliveryBy: "asc" },
      take: 50,
      include: {
        product: { select: { name: true } },
        buyer: { select: { name: true, email: true } },
        seller: { select: { name: true, email: true } },
      },
    }),
    prisma.walletTransaction.findMany({
      where: { type: "REFUND" },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        wallet: { include: { user: { select: { name: true, email: true } } } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Refunds &amp; stuck deliveries</h1>
        <p className="text-sm text-ink-600">
          Buyers can self-cancel an order once the delivery window elapses. Use this view
          to spot patterns (slow sellers, bad couriers) before they pile up.
        </p>
      </div>

      <section className="card p-6">
        <h2 className="font-display text-lg font-semibold">
          Past delivery window <span className="text-sm font-normal text-ink-500">({stuckOrders.length})</span>
        </h2>
        <p className="text-xs text-ink-500">
          Buyer can cancel any of these to trigger an automatic refund credit.
        </p>
        {stuckOrders.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">All orders are within their delivery window. </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-ink-100 text-sm">
              <thead className="bg-ink-50/50 text-left text-[11px] font-semibold uppercase tracking-widest text-ink-500">
                <tr>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Buyer / Seller</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {stuckOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-3 py-2">
                      <p className="font-medium">{o.product.name}</p>
                      <p className="font-mono text-[10px] text-ink-400">{o.id.slice(0, 12)}…</p>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <p>{o.buyer.name}</p>
                      <p className="text-ink-500">→ {o.seller.name}</p>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      <Price amount={o.totalPrice} />
                    </td>
                    <td className="px-3 py-2">
                      <span className="badge bg-burgundy-50 text-burgundy-700">{o.status}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-500">
                      {o.expectedDeliveryBy ? `${timeAgo(o.expectedDeliveryBy)} ago` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card p-6">
        <h2 className="font-display text-lg font-semibold">
          Recent refund ledger <span className="text-sm font-normal text-ink-500">({recentRefunds.length})</span>
        </h2>
        <p className="text-xs text-ink-500">Most-recent first; capped at 50.</p>
        {recentRefunds.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">No refunds issued yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-100">
            {recentRefunds.map((t) => {
              const positive = t.amountCents > 0;
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-medium">{t.description}</p>
                    <p className="text-[11px] text-ink-500">
                      {t.wallet.user.name} ({t.wallet.user.email}) · {timeAgo(t.createdAt)}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 text-sm font-semibold ${
                      positive ? "text-emerald-accent" : "text-burgundy-700"
                    }`}
                  >
                    {positive ? "+" : "−"}
                    <Price amount={Math.abs(t.amountCents) / 100} />
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-xs text-ink-500">
        Detail on any specific order:{" "}
        <Link href="/admin/orders" className="text-violet-700 hover:underline">browse orders →</Link>
      </p>
    </div>
  );
}
