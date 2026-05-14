import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Price } from "@/components/Price";
import { timeAgo } from "@/lib/utils";

export default async function AdminPayoutsPage() {
  await requireAdmin();
  const payouts = await prisma.payoutRequest.findMany({
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const grouped = {
    PENDING: payouts.filter((p) => p.status === "PENDING"),
    PROCESSING: payouts.filter((p) => p.status === "PROCESSING"),
    PAID: payouts.filter((p) => p.status === "PAID"),
    FAILED: payouts.filter((p) => p.status === "FAILED"),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Payouts</h1>
        <p className="text-sm text-ink-600">
          Live status from Monnify. In dev (stub mode) all payouts return PAID immediately.
        </p>
      </div>

      {(["PROCESSING", "PENDING", "FAILED", "PAID"] as const).map((status) => {
        const rows = grouped[status];
        if (rows.length === 0) return null;
        return (
          <section key={status}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-500">
              {status} ({rows.length})
            </h2>
            <ul className="card divide-y divide-ink-100">
              {rows.map((p) => {
                const dest = safeParseDest(p.destinationJson);
                return (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">
                        <Link href={`/u/${p.user.id}`} className="hover:underline">
                          {p.user.name}
                        </Link>
                        <span className="ml-2 text-xs text-ink-500">{p.user.email}</span>
                      </p>
                      <p className="text-xs text-ink-500">
                        {dest.accountName ?? "—"} · {dest.bankCode ?? "?"} · {maskAccount(dest.accountNumber)}
                        {p.externalRef && <> · ref {p.externalRef}</>}
                      </p>
                      {p.failureReason && (
                        <p className="mt-1 text-xs text-burgundy-700">{p.failureReason}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold"><Price amount={p.amountCents / 100} /></p>
                      <p className="text-xs text-ink-500">{timeAgo(p.createdAt)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {payouts.length === 0 && (
        <div className="card p-10 text-center text-sm text-ink-500">
          No payouts yet.
        </div>
      )}
    </div>
  );
}

function safeParseDest(raw: string): { bankCode?: string; accountNumber?: string; accountName?: string } {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function maskAccount(s: string | undefined): string {
  if (!s) return "—";
  if (s.length <= 4) return s;
  return "•••• " + s.slice(-4);
}
