import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { timeAgo } from "@/lib/utils";
import { BusinessNameDecisionRow } from "./BusinessNameDecisionRow";

export default async function AdminBusinessNameChangesPage() {
  await requireAdmin();

  const pending = await prisma.businessNameChangeRequest.findMany({
    where: { status: "PENDING" },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          isSeller: true,
          sellerVerified: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const recent = await prisma.businessNameChangeRequest.findMany({
    where: { status: { in: ["APPROVED", "REJECTED"] } },
    include: { user: { select: { name: true } } },
    orderBy: { reviewedAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Business name changes</h1>
        <p className="text-sm text-ink-600">
          Approve or reject seller requests to change their business name.
          Approval updates the user&apos;s shop name immediately across every
          product card and public profile; rejection leaves the current name
          intact.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-500">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="card p-8 text-center text-sm text-ink-500">
            No pending change requests.
          </div>
        ) : (
          <ul className="space-y-3">
            {pending.map((r) => (
              <li key={r.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg font-semibold">
                      {r.user.name}
                      {r.user.sellerVerified && (
                        <span className="ml-2 text-emerald-accent">✓</span>
                      )}
                      <span className="ml-2 text-xs font-normal text-ink-500">
                        · {r.user.email}
                      </span>
                    </p>
                    <p className="text-xs text-ink-500">
                      Requested {timeAgo(r.createdAt)}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                      <span className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-1.5 font-medium text-ink-700">
                        Current: {r.currentName ?? "—"}
                      </span>
                      <span className="text-ink-400">→</span>
                      <span className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 font-display font-semibold text-violet-800">
                        New: {r.requestedName}
                      </span>
                    </div>

                    {r.decisionNote && (
                      <p className="mt-3 max-w-2xl rounded-lg border border-ink-100 bg-ink-50/40 p-3 text-xs text-ink-700">
                        <span className="font-semibold">Reason: </span>
                        {r.decisionNote}
                      </p>
                    )}
                  </div>
                  <BusinessNameDecisionRow id={r.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-500">
            Recent decisions
          </h2>
          <ul className="card divide-y divide-ink-100">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between p-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-medium">{r.user.name}</span>
                  <span className="ml-2 text-xs text-ink-500">
                    {r.currentName ?? "—"} → {r.requestedName}
                  </span>
                </span>
                <span
                  className={
                    r.status === "APPROVED" ? "text-emerald-accent" : "text-burgundy-700"
                  }
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
