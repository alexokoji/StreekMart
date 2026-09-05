import Link from "next/link";

// Paired editorial banners — a light one and a dark one side by side.
// Sits between the product rails and the sell/design CTA to break up the
// run of grids with something full-width and image-led.
export type PromoBanner = {
  eyebrow?: string;
  title: string;
  accent: string;
  bullets: string[];
  ctaLabel: string;
  ctaHref: string;
  script: string;
  image: string | null;
  tone: "light" | "dark";
};

export function PromoBannerDuo({ banners }: { banners: PromoBanner[] }) {
  if (banners.length === 0) return null;
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {banners.map((b) => (
        <Banner key={b.title} banner={b} />
      ))}
    </section>
  );
}

function Banner({ banner }: { banner: PromoBanner }) {
  const dark = banner.tone === "dark";
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border ${
        dark
          ? "border-ink-800 bg-ink-900 text-white dark:border-ink-700"
          : "border-ink-100 bg-violet-50 text-ink-900 dark:border-ink-700 dark:bg-ink-800 dark:text-white"
      }`}
    >
      <div className="grid grid-cols-[1.15fr_1fr] items-stretch">
        <div className="flex flex-col justify-center gap-3 p-6 sm:p-8">
          {banner.eyebrow && (
            <p className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${dark ? "text-gold-300" : "text-violet-700 dark:text-violet-300"}`}>
              {banner.eyebrow}
            </p>
          )}
          <h3 className="font-display text-2xl font-bold leading-tight sm:text-3xl">
            {banner.title}
            <br />
            <span className={dark ? "text-gold-300" : "text-gold-500 dark:text-gold-300"}>{banner.accent}</span>
          </h3>

          <ul className={`flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] ${dark ? "text-ink-300" : "text-ink-600 dark:text-ink-300"}`}>
            {banner.bullets.map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <CheckIcon />
                {t}
              </li>
            ))}
          </ul>

          <div className="pt-1">
            <Link
              href={banner.ctaHref}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold transition-colors sm:text-sm ${
                dark
                  ? "bg-gold-400 text-ink-900 hover:bg-gold-300"
                  : "bg-violet-600 text-white hover:bg-violet-700"
              }`}
            >
              {banner.ctaLabel} <ArrowIcon />
            </Link>
          </div>
        </div>

        <div className="relative min-h-[190px] overflow-hidden sm:min-h-[220px]">
          {banner.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={banner.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className={`h-full w-full ${dark ? "bg-ink-800" : "bg-violet-100 dark:bg-ink-700"}`} />
          )}
          <p
            className={`pointer-events-none absolute bottom-4 right-4 text-right font-display text-sm font-bold italic leading-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)] sm:text-base ${
              dark ? "text-gold-200" : "text-white"
            }`}
          >
            {banner.script.split("\n").map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
