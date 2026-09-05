import Link from "next/link";

// Minimal end-of-page strip that replaces the old marketing footer.
//
// The app shell shouldn't end in a wall of link columns — but Privacy and
// Terms can't just disappear either: they're linked from the Meta app
// configuration (data-deletion flow) and are required by the app stores.
// One quiet line keeps them reachable without reintroducing a footer.
export function LegalStrip() {
  const year = new Date().getFullYear();
  return (
    <div className="band band-base border-t border-ink-100 dark:border-ink-800">
      <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 py-5 text-[11px] text-ink-500 sm:justify-between sm:px-6 lg:px-10 dark:text-ink-400">
        <span>© {year} StreekMart</span>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/support" className="link-wipe hover:text-violet-700 dark:hover:text-violet-300">
            Support
          </Link>
          <Link href="/privacy-policy" className="link-wipe hover:text-violet-700 dark:hover:text-violet-300">
            Privacy
          </Link>
          <Link href="/terms-and-conditions" className="link-wipe hover:text-violet-700 dark:hover:text-violet-300">
            Terms
          </Link>
        </nav>
      </div>
    </div>
  );
}
