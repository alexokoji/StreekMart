// Full-bleed page band.
//
// The storefront is built as a stack of these rather than a column of
// floating cards: each band breaks out of <main>'s horizontal padding,
// paints edge to edge, then re-applies the padding inside so content stays
// aligned with the header. Stacked flush with no margin between them, the
// page reads as one continuous surface — a tonal step (and a hairline)
// marks where one section ends and the next begins.
//
// Surface colours live in globals.css (.band-base / .band-raised /
// .band-deep) so they aren't clobbered by the dark-mode escape hatch's
// !important rules on .bg-white / .bg-ink-*.
import Link from "next/link";

export type BandTone = "base" | "raised" | "deep";

export function Band({
  children,
  tone = "base",
  className = "",
  size = "normal",
}: {
  children: React.ReactNode;
  tone?: BandTone;
  className?: string;
  /** `tight` for utility strips (filters), `normal` for content sections. */
  size?: "tight" | "normal";
}) {
  const pad = size === "tight" ? "py-5" : "py-12 sm:py-16";
  return (
    <section className={`band band-${tone} -mx-4 sm:-mx-6 lg:-mx-10 ${className}`}>
      <div className={`mx-auto w-full max-w-[1800px] px-4 sm:px-6 lg:px-10 ${pad}`}>
        {children}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * PageCanvas — cancels <main>'s padding so bands run edge to edge and
 * meet the header and footer with no seam. Wrap any page that's built
 * from Bands in this.
 * ------------------------------------------------------------------ */
export function PageCanvas({ children }: { children: React.ReactNode }) {
  return <div className="-mt-6 -mb-28 lg:-mb-10">{children}</div>;
}

/* ------------------------------------------------------------------ *
 * PageHead — the standard page opener: an accent band carrying an
 * optional back link, an eyebrow, the title, and a subtitle. Keeps every
 * inner page introducing itself the same way the storefront does.
 * ------------------------------------------------------------------ */
export function PageHead({
  eyebrow,
  title,
  subtitle,
  backHref,
  backLabel = "Back",
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  /** Optional right-aligned slot (a CTA, a filter, a count). */
  action?: React.ReactNode;
}) {
  return (
    <Band tone="deep" size="tight">
      <div className="flex flex-wrap items-end justify-between gap-4 py-3">
        <div className="min-w-0">
          {backHref && (
            <Link
              href={backHref}
              className="link-wipe mb-2 inline-block text-xs font-medium text-violet-700 dark:text-violet-300"
            >
              ← {backLabel}
            </Link>
          )}
          {eyebrow && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-700 dark:text-violet-300">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 max-w-2xl text-sm text-ink-600 dark:text-ink-300">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </Band>
  );
}
