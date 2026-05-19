import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { PromotionStatus } from "@/lib/enums";
import { parseJsonArray, timeAgo } from "@/lib/utils";
import { PromotionDecisionRow } from "./PromotionDecisionRow";

export default async function AdminPromotionsPage() {
  await requireAdmin();
  const now = new Date();

  const pending = await prisma.promotion.findMany({
    where: { status: PromotionStatus.PENDING_REVIEW },
    include: {
      product: { select: { id: true, name: true, imagesJson: true, price: true, category: true } },
      owner: { select: { id: true, name: true, email: true, sellerVerified: true } },
    },
    orderBy: { paidAt: "asc" },
  });

  const live = await prisma.promotion.findMany({
    where: {
      status: PromotionStatus.APPROVED,
      endsAt: { gt: now },
      productId: { not: null },
    },
    include: {
      product: { select: { id: true, name: true, imagesJson: true } },
      owner: { select: { name: true } },
    },
    orderBy: { endsAt: "asc" },
    take: 20,
  });

  const recent = await prisma.promotion.findMany({
    where: {
      status: { in: [PromotionStatus.APPROVED, PromotionStatus.REJECTED] },
      reviewedAt: { not: null },
    },
    include: {
      product: { select: { name: true } },
      owner: { select: { name: true } },
    },
    orderBy: { reviewedAt: "desc" },
    take: 15,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Promotions</h1>
        <p className="text-sm text-ink-600">
          Approve paid promotion requests to surface them in the homepage slider.
          Approvals start a 3-day run immediately; rejections refund ₦500 to the
          seller&apos;s wallet.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-500">
          Awaiting review ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="card p-8 text-center text-sm text-ink-500">
            No paid promotions waiting on approval.
          </div>
        ) : (
          <ul className="space-y-3">
            {pending.map((p) => {
              const img = p.product ? parseJsonArray(p.product.imagesJson)[0] : null;
              return (
                <li key={p.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 gap-4">
                      {img && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img}
                          alt={p.product?.name ?? ""}
                          className="h-24 w-24 shrink-0 rounded-lg border border-ink-100 object-cover"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-display text-lg font-semibold">
                          {p.product?.name ?? "(deleted product)"}
                          <span className="ml-2 badge bg-violet-50 text-violet-700">
                            ₦{(p.priceCents / 100).toFixed(0)} · 3 days
                          </span>
                        </p>
                        <p className="text-xs text-ink-500">
                          Seller: {p.owner.name}
                          {p.owner.sellerVerified && (
                            <span className="ml-1 text-emerald-accent">✓</span>
                          )}{" "}
                          · {p.owner.email}
                        </p>
                        <p className="mt-1 text-xs text-ink-500">
                          Paid {p.paidAt ? timeAgo(p.paidAt) : "—"}
                          {p.paymentTxnRef && (
                            <span className="ml-2 font-mono text-[10px] text-ink-400">
                              {p.paymentTxnRef}
                            </span>
                          )}
                        </p>
                        {p.product && (
                          <Link
                            href={`/products/${p.product.id}`}
                            target="_blank"
                            className="mt-2 inline-flex text-xs text-violet-700 hover:underline"
                          >
                            Preview product →
                          </Link>
                        )}
                      </div>
                    </div>
                    <PromotionDecisionRow id={p.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {live.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-500">
            Currently running ({live.length})
          </h2>
          <ul className="card divide-y divide-ink-100">
            {live.map((p) => (
              <li key={p.id} className="flex items-center justify-between p-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-medium">{p.product?.name ?? "(deleted)"}</span>
                  <span className="ml-2 text-xs text-ink-500">by {p.owner.name}</span>
                </span>
                <span className="text-xs text-ink-500">
                  ends {timeAgo(p.endsAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-500">
            Recent decisions
          </h2>
          <ul className="card divide-y divide-ink-100">
            {recent.map((p) => (
              <li key={p.id} className="flex items-center justify-between p-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-medium">{p.product?.name ?? "(deleted)"}</span>
                  <span className="ml-2 text-xs text-ink-500">by {p.owner.name}</span>
                </span>
                <span
                  className={
                    p.status === PromotionStatus.APPROVED
                      ? "text-emerald-accent"
                      : "text-burgundy-700"
                  }
                >
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
