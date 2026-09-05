import Link from "next/link";
import { Magnetic, ParallaxLayer, Reveal, CountUp } from "@/components/motion/Motion";

// Immersive editorial hero.
//
// Three things make it feel alive rather than printed:
//   1. The headline words rise into place on load (staggered, CSS-only).
//   2. The image collage drifts against the cursor (ParallaxLayer), and each
//      frame sits at a different depth so the parallax reads as real space.
//   3. The CTAs are magnetic — they lean toward the pointer before you click.
//
// Everything degrades to a static, fully legible hero under
// prefers-reduced-motion or on touch devices.
export type HeroShot = { id: string; src: string; alt: string };

export function LivingHero({
  images,
  productCount,
  designerCount,
}: {
  images: HeroShot[];
  productCount: number;
  designerCount: number;
}) {
  const [a, b, c] = images;

  return (
    <section className="grain relative -mx-4 overflow-hidden bg-ink-900 text-white sm:-mx-6 lg:-mx-10">
      {/* Ambient blooms — the only things moving when the page is idle. */}
      <div className="float-slow pointer-events-none absolute -left-24 top-0 h-[26rem] w-[26rem] rounded-full bg-violet-700/30 blur-[100px]" />
      <div
        className="float-slow pointer-events-none absolute -right-20 bottom-0 h-[22rem] w-[22rem] rounded-full bg-fuchsia-600/20 blur-[100px]"
        style={{ animationDelay: "-4s" }}
      />

      <div className="relative mx-auto grid w-full max-w-[1800px] items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:px-10 lg:py-24">
        {/* ---------------- Copy ---------------- */}
        <div>
          <Reveal y={16}>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-gold-200 backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-300" />
              Nigeria&rsquo;s fashion marketplace
            </span>
          </Reveal>

          {/* Kinetic headline — each word is its own animated block. */}
          <h1 className="mt-6 font-display text-[clamp(2.75rem,7vw,5.5rem)] font-bold leading-[0.88] tracking-[-0.03em]">
            <span className="block overflow-hidden">
              <span className="rise-word" style={{ ["--i" as string]: 0 }}>
                Dress
              </span>{" "}
              <span className="rise-word" style={{ ["--i" as string]: 1 }}>
                like
              </span>
            </span>
            <span className="block overflow-hidden">
              <span className="rise-word italic text-gold-300" style={{ ["--i" as string]: 2 }}>
                nobody
              </span>{" "}
              <span className="rise-word" style={{ ["--i" as string]: 3 }}>
                else.
              </span>
            </span>
          </h1>

          <Reveal delay={420} y={18}>
            <p className="mt-6 max-w-md text-base leading-relaxed text-white/70">
              Fabrics by the yard, ready-to-wear, and one-off pieces made to order
              — straight from the independent sellers and designers who make them.
            </p>
          </Reveal>

          <Reveal delay={520} y={18}>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Magnetic strength={0.28}>
                <Link
                  href="/products/featured"
                  className="group inline-flex items-center gap-3 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-ink-900 transition-colors hover:bg-gold-300"
                >
                  Start shopping
                  <span className="transition-transform duration-300 group-hover:translate-x-1">
                    <ArrowIcon />
                  </span>
                </Link>
              </Magnetic>
              <Magnetic strength={0.2}>
                <Link
                  href="/feed"
                  className="link-wipe text-sm font-semibold text-white/80 hover:text-white"
                >
                  Meet the designers
                </Link>
              </Magnetic>
            </div>
          </Reveal>

          {/* Live stats — count up when scrolled into view. */}
          <Reveal delay={620} y={18}>
            <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-5 border-t border-white/10 pt-6">
              <Stat value={productCount} suffix="+" label="Pieces listed" />
              <Stat value={designerCount} suffix="+" label="Verified makers" />
              <Stat value={100} suffix="%" label="Escrow protected" />
            </dl>
          </Reveal>
        </div>

        {/* ---------------- Collage ---------------- */}
        <div className="relative h-[24rem] sm:h-[30rem] lg:h-[34rem]">
          {a && (
            <ParallaxLayer depth={16} className="absolute left-0 top-4 h-[72%] w-[58%]">
              <Frame image={a} priorityLabel="Featured" />
            </ParallaxLayer>
          )}
          {b && (
            <ParallaxLayer depth={28} className="absolute right-0 top-0 h-[46%] w-[40%]">
              <Frame image={b} />
            </ParallaxLayer>
          )}
          {c && (
            <ParallaxLayer depth={40} className="absolute bottom-0 right-6 h-[46%] w-[46%]">
              <Frame image={c} />
            </ParallaxLayer>
          )}
          {!a && (
            <div className="flex h-full items-center justify-center rounded-3xl border border-white/10 text-sm text-white/40">
              StreekMart
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Frame({ image, priorityLabel }: { image: HeroShot; priorityLabel?: string }) {
  return (
    <Link
      href={`/products/${image.id}`}
      className="group relative block h-full w-full overflow-hidden rounded-2xl ring-1 ring-white/10"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.src}
        alt={image.alt}
        className="h-full w-full object-cover transition-transform duration-[900ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.07]"
      />
      {/* Caption slides up on hover — the image becomes a door, not a picture. */}
      <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-ink-900/95 to-transparent p-4 transition-transform duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0">
        <p className="line-clamp-1 text-xs font-medium text-white">{image.alt}</p>
        <p className="mt-0.5 text-[10px] uppercase tracking-widest text-gold-300">View piece →</p>
      </div>
      {priorityLabel && (
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-900">
          {priorityLabel}
        </span>
      )}
    </Link>
  );
}

function Stat({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  return (
    <div>
      <dt className="font-display text-3xl font-bold text-white">
        <CountUp to={value} suffix={suffix} />
      </dt>
      <dd className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-white/50">{label}</dd>
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
