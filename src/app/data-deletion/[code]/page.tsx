import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

// Public status page Meta sends users to after a deletion callback.
// Anyone with the confirmation code can view — the code is the only
// authorisation. We don't surface the Meta user_id or the matched
// phone here; the buyer already knows which account is theirs.

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Data deletion · StreekMart",
  // Keep crawlers off this page — the URL is technically public but
  // there's no upside to indexing personal-data confirmations.
  robots: { index: false, follow: false },
};

export default async function DataDeletionStatusPage({
  params,
}: {
  params: { code: string };
}) {
  const record = await prisma.dataDeletionRequest.findUnique({
    where: { confirmationCode: params.code },
    select: {
      status: true,
      deletedCount: true,
      notes: true,
      createdAt: true,
      completedAt: true,
    },
  });
  if (!record) notFound();

  const isCompleted = record.status === "COMPLETED";
  const isFailed = record.status === "FAILED";

  return (
    <div className="mx-auto max-w-lg py-12">
      <div className="card p-8 text-center">
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
            isCompleted
              ? "bg-emerald-100 text-emerald-700"
              : isFailed
                ? "bg-amber-100 text-amber-700"
                : "bg-sky-100 text-sky-700"
          }`}
        >
          {isCompleted ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold">
          {isCompleted
            ? "Data deletion processed"
            : isFailed
              ? "We couldn't process your request"
              : "Data deletion pending"}
        </h1>
        <p className="mt-2 text-sm text-ink-600">
          {isCompleted ? (
            record.deletedCount > 0 ? (
              <>
                We removed <strong>{record.deletedCount}</strong> message
                record{record.deletedCount === 1 ? "" : "s"} associated with
                your account. Nothing else of yours remains in our WhatsApp
                concierge history.
              </>
            ) : (
              "We didn't have any WhatsApp concierge data on file for your account — nothing to delete."
            )
          ) : isFailed ? (
            <>
              Something went wrong validating your request. If you
              submitted this from Meta&rsquo;s settings page, try again or
              email{" "}
              <a
                href="mailto:support@streekmart.online"
                className="text-violet-700 hover:underline"
              >
                support@streekmart.online
              </a>
              .
            </>
          ) : (
            "Your request is queued. Check back shortly."
          )}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-3 text-left text-xs">
          <div>
            <dt className="font-semibold uppercase tracking-widest text-ink-500">
              Confirmation code
            </dt>
            <dd className="mt-0.5 break-all font-mono">{params.code}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-widest text-ink-500">
              Requested
            </dt>
            <dd className="mt-0.5">
              {record.createdAt.toLocaleString("en-NG", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "numeric",
              })}
            </dd>
          </div>
        </dl>

        <div className="mt-6">
          <Link href="/" className="btn-primary">
            Continue to StreekMart
          </Link>
        </div>

        <p className="mt-6 text-xs text-ink-500">
          Want to also delete your StreekMart account in full? Email
          support@streekmart.online from the address on file.
        </p>
      </div>
    </div>
  );
}
