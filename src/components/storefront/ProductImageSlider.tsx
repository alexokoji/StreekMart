"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Lightweight image carousel used on product cards and the product detail
 * page. Hand-rolled (no embla / swiper / keen) to match the existing
 * PromotionSlider pattern and avoid a new dependency.
 *
 * Now backed by native horizontal scroll-snap:
 *   - Touch swipe is the browser's native momentum scroll — no
 *     pointer-event maths, no jank.
 *   - Trackpad horizontal-scroll and shift+wheel both work for free.
 *   - Chevrons programmatically scroll to the next snap point.
 *   - Auto-advance every AUTO_INTERVAL_MS, paused while the pointer is on
 *     the slider or while the document is hidden.
 *   - Dots and chevron state sync with the actually-visible image via a
 *     scroll listener (rather than tracking index ourselves), so any input
 *     mechanism stays in lockstep with the dot indicator.
 */

const AUTO_INTERVAL_MS = 4000;

export function ProductImageSlider({
  images,
  alt,
  objectFit = "cover",
  showThumbnails = false,
  chevronVisibility = "hover",
}: {
  images: string[];
  alt: string;
  objectFit?: "cover" | "contain";
  showThumbnails?: boolean;
  chevronVisibility?: "always" | "hover";
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  // `paused` short-circuits the auto-advance timer. Flipped when the
  // pointer is over the slider, when the tab is hidden, or when the user
  // explicitly clicks a chevron / dot (gives them control without us
  // immediately advancing past their pick).
  const [paused, setPaused] = useState(false);

  const safeIndex = images.length > 0 ? Math.min(index, images.length - 1) : 0;

  // Programmatic scroll to a given index. Used by chevrons + dots + auto-
  // advance. `behavior: "smooth"` triggers the browser's native easing so
  // it feels identical to a finger swipe.
  const scrollTo = useCallback((nextIdx: number, smooth = true) => {
    const el = scrollerRef.current;
    if (!el) return;
    const width = el.clientWidth;
    el.scrollTo({
      left: nextIdx * width,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  const go = useCallback(
    (delta: number) => {
      if (images.length === 0) return;
      const next = (safeIndex + delta + images.length) % images.length;
      scrollTo(next);
    },
    [images.length, safeIndex, scrollTo],
  );

  // Sync `index` with whichever snap point the scroller actually rests on.
  // Triggered by user swipe, trackpad scroll, programmatic scrollTo, etc.
  // Throttled with rAF so the dot/chevron state updates only once per
  // paint regardless of how fast the user flicks.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let frame = 0;
    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const node = scrollerRef.current;
        if (!node) return;
        const width = node.clientWidth;
        if (width === 0) return;
        const next = Math.round(node.scrollLeft / width);
        setIndex((cur) => (cur === next ? cur : next));
      });
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Auto-advance. Skipped when:
  //   - the user is interacting (`paused`)
  //   - there's only one image
  //   - the document is hidden (don't burn frames on a backgrounded tab)
  useEffect(() => {
    if (images.length <= 1) return;
    if (paused) return;
    if (typeof document !== "undefined" && document.hidden) return;
    const id = setInterval(() => {
      const el = scrollerRef.current;
      if (!el) return;
      const width = el.clientWidth;
      if (width === 0) return;
      const current = Math.round(el.scrollLeft / width);
      const next = (current + 1) % images.length;
      el.scrollTo({ left: next * width, behavior: "smooth" });
    }, AUTO_INTERVAL_MS);
    return () => clearInterval(id);
  }, [images.length, paused]);

  // Background-tab pause. Cheap and avoids surprising the user with a
  // half-cycled slider when they switch back.
  useEffect(() => {
    function onVis() {
      setPaused((p) => (document.hidden ? true : false));
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  function stop(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  const chevronBase =
    chevronVisibility === "always"
      ? "opacity-90"
      : "opacity-0 transition-opacity duration-200 group-hover:opacity-90";

  return (
    <div className="flex h-full w-full flex-col">
      <div
        className="group relative h-full w-full"
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        {images.length > 0 ? (
          <div
            ref={scrollerRef}
            // Native horizontal scroller with snap. `scrollbar-hide` is a
            // utility class — emits the standard cross-browser rules to
            // hide the scrollbar visually while leaving the scroll
            // behaviour intact. Defined in globals.css if not already
            // present (tailwindcss-scrollbar-hide plugin equivalent).
            className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ touchAction: "pan-x" }}
          >
            {images.map((src, i) => (
              <div
                key={i}
                className="relative h-full w-full shrink-0 snap-center"
                aria-hidden={i === safeIndex ? undefined : true}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={i === 0 ? alt : ""}
                  draggable={false}
                  className={`h-full w-full select-none ${
                    objectFit === "contain" ? "object-contain" : "object-cover"
                  }`}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-ink-300">
            No image
          </div>
        )}

        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={(e) => {
                stop(e);
                go(-1);
              }}
              className={`absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow-sm hover:bg-white ${chevronBase}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={(e) => {
                stop(e);
                go(1);
              }}
              className={`absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow-sm hover:bg-white ${chevronBase}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full transition-all ${
                    i === safeIndex
                      ? "w-3 bg-white shadow ring-1 ring-black/30"
                      : "bg-white/60"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {showThumbnails && images.length > 1 && (
        <div className="grid grid-cols-5 gap-2 p-2">
          {images.map((src, i) => (
            <button
              type="button"
              key={i}
              onClick={(e) => {
                stop(e);
                scrollTo(i);
              }}
              className={`aspect-square overflow-hidden rounded border-2 transition ${
                i === safeIndex
                  ? "border-violet-500"
                  : "border-transparent hover:border-ink-200"
              }`}
              aria-label={`View image ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="h-full w-full bg-gray-100 object-contain"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
