import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import { timeAgo } from "@/lib/utils";
import { VerificationDecisionRow } from "./VerificationDecisionRow";

// Pull a wide profile-detail select on every request — pending and decided
// both. The previous version only surfaced request-side fields, which
// meant a reviewer couldn't sanity-check the request against the user's
// actual profile (address, phone, city) without leaving the page, and
// decided rows showed almost nothing at all.
const USER_DETAIL_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  bio: true,
  isSeller: true,
  isDesigner: true,
  sellerVerified: true,
  designerVerified: true,
  sellerTier: true,
  designerTier: true,
  businessName: true,
  country: true,
  region: true,
  city: true,
} as const;

export default async function AdminVerificationsPage() {
  await requireAdmin(ADMIN_PERMISSIONS.MANAGE_VERIFICATIONS);
  const requests = await prisma.verificationRequest.findMany({
    where: { status: "PENDING" },
    include: { user: { select: USER_DETAIL_SELECT } },
    orderBy: { createdAt: "asc" },
  });

  const recent = await prisma.verificationRequest.findMany({
    where: { status: { in: ["APPROVED", "REJECTED"] } },
    include: { user: { select: USER_DETAIL_SELECT } },
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

// Shared row card. Renders the full set of fields a reviewer needs to
// decide — request-side fields (ID, business name, CAC, etc.) AND the
// user's profile-side fields (saved business name on User, city, country,
// phone) so they can cross-check. The same card is used for pending rows
// (with approve/reject buttons) and decided rows (with a status chip),
// so after approval the admin can still scroll back and see every detail
// that was filled in.
function RequestCard({
  r,
  mode,
}: {
  // The shape coming back from Prisma is broad; locally narrowing with a
  // small inline type beats threading the full Prisma payload type through.
  r: {
    id: string;
    kind: string;
    tier: number;
    status: string;
    idType: string | null;
    idNumber: string | null;
    idDocumentUrl: string | null;
    businessName: string | null;
    businessAddress: string | null;
    hasPhysicalStore: boolean;
    storeImageUrl: string | null;
    cacDocumentUrl: string | null;
    notes: string | null;
    decisionNote: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
    user: {
      id: string;
      name: string;
      email: string;
      phone: string | null;
      bio: string | null;
      isSeller: boolean;
      isDesigner: boolean;
      sellerVerified: boolean;
      designerVerified: boolean;
      sellerTier: number;
      designerTier: number;
      businessName: string | null;
      country: string | null;
      region: string | null;
      city: string | null;
    };
  };
  mode: "pending" | "decided";
}) {
  const profileLocation = [r.user.city, r.user.region, r.user.country]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Header */}
          <p className="font-display text-lg font-semibold">
            {r.user.name}
            <span className="ml-2 badge bg-violet-50 text-violet-700">{r.kind}</span>
            <span className="ml-2 badge bg-sky-50 text-sky-700">Tier {r.tier}</span>
            {r.tier === 3 && (
              <span className="ml-2 badge bg-ink-50 text-ink-700">
                {r.hasPhysicalStore ? "Physical store" : "Online-only"}
              </span>
            )}
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

          {/* Profile snapshot — the User row's saved fields. Always shown
              so the reviewer can compare request-side intake against the
              user's account-wide profile, and so an after-approval audit
              still sees the full picture. */}
          <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
            <Field label="Profile business name" value={r.user.businessName} />
            <Field label="Profile phone" value={r.user.phone} />
            <Field label="Profile location" value={profileLocation || null} />
            <Field
              label="Roles"
              value={
                [
                  r.user.isSeller && "Seller",
                  r.user.isDesigner && "Designer",
                ]
                  .filter(Boolean)
                  .join(" · ") || "Buyer"
              }
            />
            {r.user.bio && (
              <div className="sm:col-span-2">
                <dt className="font-semibold uppercase tracking-widest text-ink-500">
                  Bio
                </dt>
                <dd className="mt-0.5 whitespace-pre-wrap">{r.user.bio}</dd>
              </div>
            )}
          </dl>

          <div className="my-4 h-px bg-ink-100" />

          {/* Tier 2 — ID intake */}
          {r.tier === 2 && (
            <dl className="grid gap-3 text-xs sm:grid-cols-2">
              <Field label="ID type" value={idTypeLabel(r.idType)} />
              <Field label="ID number" value={r.idNumber} mono />
            </dl>
          )}

          {/* Tier 3 — business intake */}
          {r.tier === 3 && (
            <dl className="grid gap-3 text-xs sm:grid-cols-2">
              <Field label="Request business name" value={r.businessName} />
              <Field label="Request address" value={r.businessAddress} />
            </dl>
          )}

          {/* Documents — both tiers */}
          {(r.idDocumentUrl || r.storeImageUrl || r.cacDocumentUrl) && (
            <div className="mt-3 flex flex-wrap gap-3">
              {r.idDocumentUrl && (
                <DocLink href={r.idDocumentUrl} label="ID document" />
              )}
              {r.storeImageUrl && (
                <DocLink href={r.storeImageUrl} label="Storefront photo" />
              )}
              {r.cacDocumentUrl && (
                <DocLink href={r.cacDocumentUrl} label="CAC certificate" />
              )}
            </div>
          )}

          {r.notes && (
            <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm text-ink-700">
              <span className="font-semibold uppercase tracking-widest text-[10px] text-ink-500">
                Applicant notes:
              </span>{" "}
              {r.notes}
            </p>
          )}

          {/* Decision note — only appears after a decision, captures the
              admin's reason for rejection or any approval caveats. */}
          {r.decisionNote && (
            <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm text-ink-700">
              <span className="font-semibold uppercase tracking-widest text-[10px] text-ink-500">
                Reviewer note:
              </span>{" "}
              {r.decisionNote}
            </p>
          )}
        </div>

        {mode === "pending" && <VerificationDecisionRow id={r.id} />}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="font-semibold uppercase tracking-widest text-ink-500">
        {label}
      </dt>
      <dd
        className={`mt-0.5 whitespace-pre-wrap ${
          mono ? "font-mono tracking-wide" : "font-medium"
        }`}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

function DocLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="group block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={href}
        alt={label}
        className="h-28 w-40 rounded-lg border border-ink-200 object-cover group-hover:border-violet-400"
      />
      <p className="mt-1 text-[10px] text-ink-500">{label}</p>
    </a>
  );
}

function idTypeLabel(raw: string | null): string | null {
  switch (raw) {
    case "NIN":
      return "NIN (National ID)";
    case "PASSPORT":
      return "Passport";
    case "DRIVERS_LICENSE":
      return "Driver's licence";
    default:
      return raw;
  }
}
