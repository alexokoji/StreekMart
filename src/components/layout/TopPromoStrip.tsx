// Thin announcement bar above the header — free-shipping / trust messaging,
// same structural role as most fashion-marketplace headers (promo bar →
// nav → hero). Kept purely presentational; no state, so it can render on
// every page without a client boundary.
export function TopPromoStrip() {
  return (
    <div className="hidden bg-ink-900 text-white sm:block dark:bg-black">
      <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between gap-4 px-6 py-2 text-xs lg:px-10">
        <span className="flex items-center gap-1.5 font-medium">
          <TruckIcon /> Fast delivery on every order
        </span>
        <span className="hidden items-center gap-4 text-ink-300 md:flex">
          <span>Fashion</span>
          <Dot />
          <span>Quality</span>
          <Dot />
          <span>Style</span>
          <Dot />
          <span>You</span>
        </span>
        <span className="flex items-center gap-4">
          <span className="hidden items-center gap-1.5 lg:flex">
            <ShieldIcon /> Buyer protection
          </span>
          <span className="flex items-center gap-1.5">
            <LockIcon /> Secure payments
          </span>
        </span>
      </div>
    </div>
  );
}

function Dot() {
  return <span className="h-0.5 w-0.5 rounded-full bg-ink-500" aria-hidden />;
}

function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="1" y="6" width="14" height="10" rx="1" />
      <path d="M15 9h4l3 3v4h-7z" />
      <circle cx="6" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M7 10V7a5 5 0 0110 0v3" />
    </svg>
  );
}
