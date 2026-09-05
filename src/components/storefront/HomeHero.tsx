import Link from "next/link";

// Editorial split hero — copy panel on the left, image collage on the
// right with a script-styled overlay. Replaces the old full-bleed gradient
// card: the split gives the headline room to breathe at display size and
// puts real product photography above the fold, which the gradient never
// did.
//
// Palette stays on-brand (violet / fuchsia / gold / ink) — the structure is
// what changed, not the colours.
export type HeroImage = { id: string; src: string; alt: string };

export function HomeHero({ images }: { images: HeroImage[] }) {
  const [a, b, c] = images;

  return (
    <section className="overflow-hidden rounded-3xl border border-ink-100 bg-violet-50 dark:border-ink-700 dark:bg-ink-800">
      <div className="grid md:grid-cols-[1.05fr_1fr]">
        {/* ---------- Copy panel ---------- */}
        <div className="flex flex-col justify-center gap-5 px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-700 dark:text-violet-300">
            Wear what moves you
          </p>

          <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-tight sm:text-5xl lg:text-6xl">
            Style Lives
            <br />
            <span className="italic text-gold-500 dark:text-gold-300">Here</span>
          </h1>

          <p className="max-w-md text-sm text-ink-600 dark:text-ink-300 sm:text-base">
            Fabrics, ready-to-wear, and accessories from independent Nigerian
            sellers and designers — all in one place.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/products/featured"
              className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
            >
              Shop now <ArrowIcon />
            </Link>
            <Link
              href="/products/flash-sales"
              className="inline-flex items-center rounded-full border border-ink-300 px-6 py-3 text-sm font-semibold text-ink-800 transition-colors hover:border-violet-500 hover:text-violet-700 dark:border-ink-500 dark:text-white dark:hover:border-violet-400 dark:hover:text-violet-300"
            >
              View sales
            </Link>
          </div>

          {/* Trust row — the three promises that matter most at first contact. */}
          <ul className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-ink-600 dark:text-ink-300">
            <TrustItem icon={<StarIcon />} label="Trendy looks" />
            <TrustItem icon={<TruckIcon />} label="Fast delivery" />
            <TrustItem icon={<ShieldIcon />} label="Secure payment" />
          </ul>
        </div>

        {/* ---------- Image collage ---------- */}
        <div className="relative min-h-[280px] bg-ink-100 dark:bg-ink-700 sm:min-h-[360px]">
          {a ? (
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-1.5 p-1.5">
              <HeroTile image={a} className="row-span-2" />
              {b && <HeroTile image={b} />}
              {c && <HeroTile image={c} />}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-ink-400">
              StreekMart
            </div>
          )}

          {/* Script overlay — echoes the brand line without competing with
              the headline. Hidden on small screens where it would collide
              with the collage. */}
          <div className="pointer-events-none absolute bottom-5 right-5 hidden text-right lg:block">
            <p className="font-display text-2xl font-bold italic leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
              Shop.
              <br />
              Sell.
              <br />
              Style.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroTile({ image, className = "" }: { image: HeroImage; className?: string }) {
  return (
    <Link
      href={`/products/${image.id}`}
      className={`group relative overflow-hidden rounded-2xl bg-ink-200 dark:bg-ink-600 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.src}
        alt={image.alt}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
    </Link>
  );
}

function TrustItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className="text-violet-600 dark:text-violet-300">{icon}</span>
      {label}
    </li>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 5.9L12 16.4 6.6 19.3l1.3-5.9L3.4 9.3l6-.7z" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="1" y="6" width="14" height="10" rx="1" />
      <path d="M15 9h4l3 3v4h-7z" />
      <circle cx="6" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
    </svg>
  );
}
