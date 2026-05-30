import Link from "next/link";

// "Barely visible" help button anchored to the bottom-right corner of the
// viewport. Always reachable, never in the way — opacity sits low until
// the pointer is on it (desktop) or it's pressed (mobile), then it brightens
// to full visibility so the user knows it's tappable.
//
// Positioning:
//   - Bottom-right, with a small offset so it clears the iOS safe area.
//   - On mobile we sit ABOVE the BottomNav (which is `bottom-0`, ~64px
//     tall + the safe area inset) so taps don't catch the wrong target.
//   - z-50 puts it above the BottomNav's nav itself but below SmartSearch
//     modals (z-50/60).
//
// Hit area is 44×44 — well past the WCAG / Apple HIG minimum, even with the
// visible circle being smaller. Padding generates the extra hit slack so
// taps near the edge still land.
export function FloatingSupport() {
  return (
    <Link
      href="/support"
      aria-label="Help and support"
      title="Support"
      // `mb-` offsets at each breakpoint so the button sits above the
      // BottomNav (mobile) and the FAB (mobile center) without overlap.
      // On desktop the BottomNav is hidden so we use a smaller offset.
      className="
        fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] right-3
        z-40 inline-flex h-11 w-11 items-center justify-center rounded-full
        border border-ink-200/80 bg-white/70 text-ink-500 shadow-sm
        opacity-40 backdrop-blur-md transition
        hover:opacity-100 hover:text-violet-700 hover:shadow-md
        active:opacity-100 active:text-violet-800 active:scale-95
        focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400
        md:bottom-5 md:right-5
        [touch-action:manipulation]
      "
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </Link>
  );
}
