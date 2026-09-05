"use client";

// Cursor companion — a soft violet halo that trails the pointer and swells
// when it's over something clickable. This is the single biggest "the site
// is responding to me" cue, and it costs one rAF loop.
//
// Guards, in order of importance:
//   - Pointer-coarse devices (phones/tablets) get nothing — a cursor halo
//     on touch is meaningless and would just burn battery.
//   - prefers-reduced-motion disables it too.
//   - The real cursor is never hidden, so nothing breaks if this fails.

import { useEffect, useRef, useState } from "react";

const INTERACTIVE = 'a, button, input, select, textarea, summary, [role="button"], label';

export function CursorGlow() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;
    setEnabled(true);

    // Target = where the pointer is. Ring lerps toward it for a trailing lag;
    // the dot tracks 1:1 so clicks still feel precise.
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let rx = tx;
    let ry = ty;
    let raf = 0;

    function onMove(e: MouseEvent) {
      tx = e.clientX;
      ty = e.clientY;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${tx}px, ${ty}px, 0) translate(-50%, -50%)`;
      }
      const overInteractive = (e.target as Element | null)?.closest?.(INTERACTIVE);
      ringRef.current?.classList.toggle("cursor-ring--active", !!overInteractive);
    }

    function loop() {
      rx += (tx - rx) * 0.15;
      ry += (ty - ry) * 0.15;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(loop);
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      <div
        ref={ringRef}
        aria-hidden
        className="cursor-ring pointer-events-none fixed left-0 top-0 z-[100] hidden h-9 w-9 rounded-full border border-violet-500/60 transition-[width,height,background-color,border-color] duration-300 lg:block"
      />
      <div
        ref={dotRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[100] hidden h-1.5 w-1.5 rounded-full bg-violet-500 lg:block"
      />
    </>
  );
}
