"use client";

// Zero-dependency motion primitives.
//
// Deliberately not framer-motion/GSAP: everything here is IntersectionObserver
// + CSS transforms, which costs ~2KB instead of ~40KB and keeps the storefront
// fast on the mid-range Android phones most of our buyers are on.
//
// Every primitive respects prefers-reduced-motion — animations degrade to
// "already visible / no transform" rather than being merely faster.

import { useEffect, useRef, useState } from "react";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ------------------------------------------------------------------ *
 * Reveal — fades + lifts children the first time they enter view.
 * ------------------------------------------------------------------ */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  /** Stagger offset in ms. */
  delay?: number;
  /** Distance to travel, px. */
  y?: number;
  className?: string;
  as?: "div" | "section" | "li" | "span";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect(); // one-shot: re-animating on every scroll-by is noise
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      // @ts-expect-error — polymorphic ref, safe for the tags we allow
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : `translate3d(0, ${y}px, 0)`,
        transition: `opacity 700ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 700ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        willChange: shown ? "auto" : "opacity, transform",
      }}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ *
 * Magnetic — element drifts toward the cursor, springs back on leave.
 * ------------------------------------------------------------------ */
export function Magnetic({
  children,
  strength = 0.35,
  className = "",
}: {
  children: React.ReactNode;
  /** 0 = inert, 1 = element sticks to the cursor. */
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    function onMove(e: MouseEvent) {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate3d(${dx * strength}px, ${dy * strength}px, 0)`;
    }
    function onLeave() {
      const el = ref.current;
      if (el) el.style.transform = "translate3d(0,0,0)";
    }

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [strength]);

  return (
    <div
      ref={ref}
      className={`inline-block transition-transform duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] ${className}`}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Marquee — infinite ticker. Duplicated track so the loop is seamless.
 * ------------------------------------------------------------------ */
export function Marquee({
  children,
  speed = 40,
  reverse = false,
  className = "",
}: {
  children: React.ReactNode;
  /** Seconds for one full pass. Higher = slower. */
  speed?: number;
  reverse?: boolean;
  className?: string;
}) {
  return (
    <div className={`group relative flex overflow-hidden ${className}`}>
      {[0, 1].map((i) => (
        <div
          key={i}
          aria-hidden={i === 1}
          className="flex shrink-0 items-center gap-8 pr-8 motion-safe:animate-[marquee_var(--marquee-duration)_linear_infinite] group-hover:[animation-play-state:paused]"
          style={
            {
              "--marquee-duration": `${speed}s`,
              animationDirection: reverse ? "reverse" : "normal",
            } as React.CSSProperties
          }
        >
          {children}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * CountUp — animates a number when it scrolls into view.
 * ------------------------------------------------------------------ */
export function CountUp({
  to,
  duration = 1600,
  suffix = "",
  className = "",
}: {
  to: number;
  duration?: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      setValue(to);
      return;
    }

    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      let frame = 0;
      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        // easeOutExpo — fast start, long settle. Reads as "counting up".
        const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
        setValue(Math.round(eased * to));
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString("en-NG")}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * ParallaxLayer — shifts with cursor position. Used by the hero collage.
 * ------------------------------------------------------------------ */
export function ParallaxLayer({
  children,
  depth = 12,
  className = "",
}: {
  children: React.ReactNode;
  /** Max px of travel at the viewport edges. */
  depth?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    function onMove(e: MouseEvent) {
      const el = ref.current;
      if (!el) return;
      const x = (e.clientX / window.innerWidth - 0.5) * 2; // -1..1
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      el.style.transform = `translate3d(${x * depth}px, ${y * depth}px, 0)`;
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [depth]);

  return (
    <div
      ref={ref}
      className={`transition-transform duration-[600ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] ${className}`}
    >
      {children}
    </div>
  );
}
