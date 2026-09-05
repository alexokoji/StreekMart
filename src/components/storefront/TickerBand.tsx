import { Marquee } from "@/components/motion/Motion";

// Full-bleed scrolling statement band. Two tracks running opposite
// directions so the eye catches the counter-motion; both pause when the
// pointer is over the band, which makes it feel deliberate rather than
// decorative.
const LINE_A = [
  "Fabrics by the yard",
  "Made to order",
  "Independent designers",
  "Escrow protected",
  "Nationwide delivery",
];
const LINE_B = [
  "Ankara",
  "Lace",
  "Ready-to-wear",
  "Accessories",
  "Native wear",
  "Beadwork",
];

export function TickerBand() {
  return (
    <section
      aria-hidden
      className="band band-deep -mx-4 select-none py-5 sm:-mx-6 lg:-mx-10"
    >
      <Marquee speed={34} className="mb-2">
        {LINE_A.map((t, i) => (
          <span key={`${t}-${i}`} className="flex items-center gap-8">
            <span className="whitespace-nowrap font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {t}
            </span>
            <Sparkle />
          </span>
        ))}
      </Marquee>

      <Marquee speed={44} reverse>
        {LINE_B.map((t, i) => (
          <span key={`${t}-${i}`} className="flex items-center gap-8">
            <span className="whitespace-nowrap font-display text-2xl font-bold italic tracking-tight text-ink-400 dark:text-white/35 sm:text-3xl">
              {t}
            </span>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
          </span>
        ))}
      </Marquee>
    </section>
  );
}

function Sparkle() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-gold-400" fill="currentColor" aria-hidden>
      <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" />
    </svg>
  );
}
