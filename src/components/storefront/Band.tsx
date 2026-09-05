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
