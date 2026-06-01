import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { timeAgo } from "@/lib/utils";
import { RoleChangeDecisionRow } from "./RoleChangeDecisionRow";

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  businessName: true,
  city: true,
  region: true,
  country: true,
} as const;

export default async function AdminRoleChangesPage() {
  await requireAdmin();
  const pending = await prisma.roleChangeRequest.findMany({
    where: { status: "PENDING" },
    include: { user: { select: USER_SELECT } },
    orderBy: { createdAt: "asc" },
  });
  const recent = await prisma.roleChangeRequest.findMany({
    where: { status: { in: ["APPROVED", "REJECTED"] } },
    include: { user: { select: USER_SELECT } },
    orderBy: { reviewedAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Role changes</h1>
        <p className="text-sm text-ink-600">
          Approve or reject role-change requests from users.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-500">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="card p-8 text-center text-sm text-ink-500">
            No pending requests.
          </div>
        ) : (
          <ul className="space-y-3">
            {pending.map((r) => (
              <li key={r.id}>
                <RequestCard r={r} mode="pending" />
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
          <ul className="space-y-3">
            {recent.map((r) => (
              <li key={r.id}>
                <RequestCard r={r} mode="decided" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type RowShape = {
  id: string;
  fromIsSeller: boolean;
  fromIsDesigner: boolean;
  toIsSeller: boolean;
  toIsDesigner: boolean;
  reason: string | null;
  status: string;
  decisionNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    businessName: string | null;
    city: string | null;
    region: string | null;
    country: string | null;
  };
};

function RequestCard({ r, mode }: { r: RowShape; mode: "pending" | "decided" }) {
  const fromRoles = roleLabel(r.fromIsSeller, r.fromIsDesigner);
  const toRoles = roleLabel(r.toIsSeller, r.toIsDesigner);
  const location = [r.user.city, r.user.region, r.user.country]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold">
            {r.user.name}
            {mode === "decided" && (
              <span
                className={`ml-2 badge ${
                  r.status === "APPROVED"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-burgundy-50 text-burgundy-700"
                }`}
              >
                {r.status}
              </span>
            )}
          </p>
          <p className="text-xs text-ink-500">
            {r.user.email} · requested {timeAgo(r.createdAt)}
            {r.reviewedAt && ` · decided ${timeAgo(r.reviewedAt)}`}
          </p>

          <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
            <Field label="From" value={fromRoles} />
            <Field label="To" value={toRoles} />
            <Field label="Business name" value={r.user.businessName ?? "—"} />
            <Field label="Location" value={location || "—"} />
          </div>

          {r.reason && (
            <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm text-ink-700">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-500">
                Reason:
              </span>{" "}
              {r.reason}
            </p>
          )}
          {r.decisionNote && (
            <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm text-ink-700">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-500">
                Reviewer note:
              </span>{" "}
              {r.decisionNote}
            </p>
          )}
        </div>

        {mode === "pending" && <RoleChangeDecisionRow id={r.id} />}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-semibold uppercase tracking-widest text-ink-500">
        {label}
      </p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}

function roleLabel(seller: boolean, designer: boolean): string {
  if (seller && designer) return "Seller · Designer";
  if (seller) return "Seller";
  if (designer) return "Designer";
  return "Buyer only";
}
