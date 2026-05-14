import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { timeAgo } from "@/lib/utils";
import { VerificationDecisionRow } from "./VerificationDecisionRow";

export default async function AdminVerificationsPage() {
  await requireAdmin();
  const requests = await prisma.verificationRequest.findMany({
    where: { status: "PENDING" },
    include: {
      user: {
        select: { id: true, name: true, email: true, isSeller: true, isDesigner: true, sellerVerified: true, designerVerified: true, bio: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const recent = await prisma.verificationRequest.findMany({
    where: { status: { in: ["APPROVED", "REJECTED"] } },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { reviewedAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Verifications</h1>
        <p className="text-sm text-ink-600">
          Approve or reject incoming verification requests.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-500">
          Pending ({requests.length})
        </h2>
        {requests.length === 0 ? (
          <div className="card p-8 text-center text-sm text-ink-500">No pending requests.</div>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-semibold">
                      {r.user.name}
                      <span className="ml-2 badge bg-violet-50 text-violet-700">{r.kind}</span>
                    </p>
                    <p className="text-xs text-ink-500">
                      {r.user.email} · requested {timeAgo(r.createdAt)}
                    </p>
                    {r.user.bio && (
                      <p className="mt-1 max-w-xl text-xs italic text-ink-500">{r.user.bio}</p>
                    )}
                    {r.notes && (
                      <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm text-ink-700">{r.notes}</p>
                    )}
                  </div>
                  <VerificationDecisionRow id={r.id} />
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
                <span>
                  <span className="font-medium">{r.user.name}</span>
                  <span className="ml-2 text-xs text-ink-500">{r.kind}</span>
                </span>
                <span className={r.status === "APPROVED" ? "text-emerald-accent" : "text-burgundy-700"}>
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
