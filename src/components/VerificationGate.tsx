import Link from "next/link";

// Stylish call-to-action that nudges unverified sellers / designers to apply
// for verification. Sellers can't list products without it; designers can
// post but won't be recommended (or sell) until verified. The banner is
// info-toned rather than scary — verification is a normal next step, not a
// failure.
//
// Renders nothing for users who are already verified for the kind we care
// about. Drop it at the top of any dashboard page; it self-suppresses.
export function VerificationGate({
  kind,
  verified,
  href,
}: {
  /**
   * Which badge we're nudging the user to get.
   *   "seller"   — required to list products.
   *   "designer" — required to be recommended + to sell.
   */
  kind: "seller" | "designer";
  verified: boolean;
  /** Where the "Apply" button links to. Defaults to /seller/verification or
   *  /designer/verification depending on `kind`. */
  href?: string;
}) {
  if (verified) return null;

  const target =
    href ?? (kind === "seller" ? "/seller/verification" : "/designer/verification");

  const copy =
    kind === "seller"
      ? {
          eyebrow: "One quick step before you sell",
          title: "Verify your shop to list products",
          body: "Verified shops get the trust badge, appear in recommendations, and can list products. Submit a photo of your storefront or your CAC certificate — usually approved within a day.",
          cta: "Start verification →",
        }
      : {
          eyebrow: "Verify your portfolio",
          title: "Get the verified-designer badge",
          body: "Verified designers appear in recommendations and can sell their pieces. Submit your business details and a CAC certificate or storefront photo — admins review every request.",
          cta: "Start verification →",
        };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-gold-50 p-5 shadow-soft">
      {/* Decorative aurora blob — gives the banner some warmth without ads. */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-fuchsia-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-gold-200/40 blur-3xl" />

      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <ShieldIcon />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-700">
              {copy.eyebrow}
            </p>
            <h2 className="mt-0.5 font-display text-lg font-semibold text-ink-900 sm:text-xl">
              {copy.title}
            </h2>
            <p className="mt-1 max-w-prose text-sm text-ink-600">{copy.body}</p>
          </div>
        </div>
        <Link
          href={target}
          className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-glow hover:bg-violet-700"
        >
          {copy.cta}
        </Link>
      </div>
    </section>
  );
}

function ShieldIcon() {
  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-glow"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    </span>
  );
}
