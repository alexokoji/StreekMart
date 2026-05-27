"use client";

import { useCallback, useState } from "react";

/**
 * Lightweight image carousel used on product cards and the product detail
 * page. Hand-rolled (no embla / swiper / keen) to match the existing
 * PromotionSlider pattern and avoid a new dependency.
 *
 * - Prev/next chevrons (always visible on detail, hover-only on cards)
 * - Dot indicators along the bottom
 * - Touch swipe via pointer events
 * - Clicking a chevron stops propagation so it doesn't trigger any
 *   surrounding <Link> (cards wrap in one)
 */
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
  const [index, setIndex] = useState(0);
  const [dragStartX, setDragStartX] = useState<number | null>(null);

  const safeIndex = images.length > 0 ? Math.min(index, images.length - 1) : 0;

  const go = useCallback(
    (delta: number) => {
      if (images.length === 0) return;
      setIndex((i) => {
        const next = i + delta;
        if (next < 0) return images.length - 1;
        if (next >= images.length) return 0;
        return next;
      });
    },
    [images.length],
  );

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
        className="group relative h-full w-full overflow-hidden"
        onPointerDown={(e) => setDragStartX(e.clientX)}
        onPointerUp={(e) => {
          if (dragStartX === null) return;
          const dx = e.clientX - dragStartX;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          setDragStartX(null);
        }}
        onPointerCancel={() => setDragStartX(null)}
      >
        {images[safeIndex] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={images[safeIndex]}
            alt={alt}
            draggable={false}
            className={`h-full w-full select-none ${
              objectFit === "contain" ? "object-contain" : "object-cover"
            }`}
          />
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
                  className={`h-1.5 w-1.5 rounded-full ${
                    i === safeIndex ? "bg-white shadow ring-1 ring-black/30" : "bg-white/60"
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
                setIndex(i);
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
