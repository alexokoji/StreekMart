// StreekMart logo.
//
// Mark: a stylised hanger whose hook is a needle, with a single thread arc
// stitched through the bar — calling out fashion (hanger) and fabric
// (needle + thread) in one shape. Wordmark uses the display serif and
// inherits the brand aurora gradient via the `.aurora-text` utility.
//
// Sized via `size` (icon edge in px). The wordmark scales with the
// surrounding font size — drop it into any nav and it inherits typography.

export function Logo({
  size = 28,
  showWordmark = true,
  className = "",
}: {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      {showWordmark && (
        <span className="font-display text-xl font-bold tracking-tight">
          <span className="aurora-text">Streek</span>
          <span className="text-ink-900">Mart</span>
        </span>
      )}
    </span>
  );
}

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="StreekMart"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Same aurora used by .aurora-text on the wordmark. */}
        <linearGradient id="sm-aurora" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4c1d95" />
          <stop offset="40%" stopColor="#7c3aed" />
          <stop offset="75%" stopColor="#d946ef" />
          <stop offset="100%" stopColor="#cf9f32" />
        </linearGradient>
        <linearGradient id="sm-thread" x1="0" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#cf9f32" />
          <stop offset="100%" stopColor="#fbf6e6" />
        </linearGradient>
      </defs>

      {/* Soft rounded backdrop so the mark works on light AND dark surfaces. */}
      <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#sm-aurora)" />

      {/* Hanger bar — gentle smile so it reads as a clothes hanger, not a frame. */}
      <path
        d="M14 40 Q32 30 50 40"
        stroke="white"
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Hanger triangle — the body that hangs from the hook. */}
      <path
        d="M14 40 L32 22 L50 40"
        stroke="white"
        strokeWidth="3.2"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      {/* Needle hook — sweeps up from the apex, curves into a small eye. */}
      <path
        d="M32 22 L32 14 Q32 9 36 9 Q40 9 40 13"
        stroke="white"
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Eye of the needle. */}
      <circle cx="40" cy="13" r="1.6" fill="white" />

      {/* Stitched thread arc — a quick over/under suggestion of fabric. */}
      <path
        d="M18 47 Q24 43 30 47 T42 47 T54 47"
        stroke="url(#sm-thread)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        strokeDasharray="3 3"
      />
    </svg>
  );
}
