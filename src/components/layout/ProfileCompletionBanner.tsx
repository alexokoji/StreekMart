import Link from "next/link";

// Sticky banner shown on every dashboard page when the signed-in user is
// missing one of the now-required identity fields. Built as a server
// component so it can short-circuit before any client JS runs.
//
// We surface this on the dashboards (seller / designer / account) rather
// than in the top nav so the prompt sits inside the user's work area
// where the action — going to Settings — is one tap away.
export function ProfileCompletionBanner({
  isSeller,
  phone,
  businessName,
  settingsHref,
}: {
  isSeller: boolean;
  phone: string | null;
  businessName: string | null;
  settingsHref: string;
}) {
  const missingPhone = !phone || phone.trim() === "";
  // Business name is only required of sellers — buyers / designer-only
  // accounts don't need a brand identity.
  const missingBusinessName = isSeller && (!businessName || businessName.trim() === "");

  if (!missingPhone && !missingBusinessName) return null;

  const missingLabels: string[] = [];
  if (missingPhone) missingLabels.push("phone number");
  if (missingBusinessName) missingLabels.push("business name");
  const joined =
    missingLabels.length === 1
      ? missingLabels[0]
      : missingLabels.slice(0, -1).join(", ") + " and " + missingLabels.at(-1);

  return (
    <div className="mb-4 rounded-xl border border-gold-300 bg-gradient-to-r from-gold-50 via-white to-gold-50 p-4 shadow-soft">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-100 text-lg">
          ⚠️
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink-900">
            Finish setting up your account
          </p>
          <p className="text-xs text-ink-600">
            Add your {joined} to keep ordering, listing, and getting paid without
            interruption.
            {missingBusinessName && (
              <span className="ml-1 font-medium text-ink-700">
                Once set, business name changes need admin approval.
              </span>
            )}
          </p>
        </div>
        <Link href={settingsHref} className="btn-primary text-sm shrink-0">
          Update now
        </Link>
      </div>
    </div>
  );
}
