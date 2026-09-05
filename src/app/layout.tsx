import type { Metadata, Viewport } from "next";
import dynamic from "next/dynamic";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import { TopPromoStrip } from "@/components/layout/TopPromoStrip";
import { TopNav } from "@/components/layout/TopNav";
import { BottomNav } from "@/components/layout/BottomNav";
import { NewsletterBar } from "@/components/layout/NewsletterBar";
import { LegalStrip } from "@/components/layout/LegalStrip";
import { FloatingSupport } from "@/components/FloatingSupport";
import { CursorGlow } from "@/components/motion/CursorGlow";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import { CurrencyProvider } from "@/components/CurrencyProvider";
import { ThemeProvider } from "@/state/ThemeContext";
import { getCurrentUser } from "@/lib/auth";
import { getServerCurrencyContext } from "@/lib/currencyServer";

// Runs before hydration (inline, blocking) so the `dark` class lands on
// <html> before first paint — avoids a flash of the wrong theme. Mirrors
// the preference logic in src/state/ThemeContext.tsx; kept in sync by hand
// since it must run standalone, before any React/module code exists.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("streekmart:theme-preference");
    var pref = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    var scheme = pref === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : pref;
    if (scheme === "dark") document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

// SmartSearch pulls in canvas-based dominant-colour extraction (image
// search) which is heavy + only used when the buyer opens the search
// panel. Lazy-load so it doesn't add to first-paint JS on every page.
// `ssr: false` is safe because the launcher uses window APIs anyway.
const SmartSearch = dynamic(
  () => import("@/components/SmartSearch").then((m) => ({ default: m.SmartSearch })),
  { ssr: false, loading: () => null },
);

// Display face — Fraunces is a variable, fashion-forward serif with an
// expressive italic. Used for headlines, prices, hero copy.
const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

// Body face — Manrope is a tight, geometric sans with a confident rhythm.
// Reads cleanly at small sizes and pairs well with Fraunces's curves.
const body = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "StreekMart — Fashion Marketplace",
  description: "Materials, ready-to-wear, and designer content — fashion only.",
  // Favicons / home-screen icons use the square /public/icon.png — same
  // asset the mobile app uses for its launcher icon so brand recognition
  // stays consistent across the web tab, the iOS home screen, and the app
  // store listings.
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

// Viewport is its own export in Next 14 (was in metadata previously).
// We don't lock zoom — users with low vision should be able to pinch-zoom.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a14",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, currencyCtx] = await Promise.all([
    getCurrentUser(),
    getServerCurrencyContext(),
  ]);
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      {/* `overflow-x-clip` is a global safety net against rogue horizontal
          scroll — a single oversized child (long unbreakable string, a
          wide table, an iframe) would otherwise let the whole page scroll
          sideways on mobile. `clip` (vs `hidden`) doesn't establish a new
          scroll container, so position:sticky inside still works. */}
      <body className="overflow-x-clip font-sans bg-ink-50 text-ink-900 dark:bg-ink-900 dark:text-white" suppressHydrationWarning>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/*
          CurrencyProvider seeds the client with the same context the server
          used to render initial prices, so SSR and hydration always agree.
          The user can override the auto-detected currency via the selector
          in the TopNav; that POSTs to /api/currency and a router.refresh()
          re-renders everything with the new context.
        */}
        <ThemeProvider>
          <CurrencyProvider ctx={currencyCtx}>
            <TopPromoStrip />
            {user && !user.emailVerifiedAt && (
              <EmailVerificationBanner email={user.email} />
            )}
            <TopNav user={user} />
            {/*
              Full-bleed layout. We add only minimal side padding and cap content
              at 3xl on enormous screens to keep line-lengths sane. The pb-28 on
              mobile leaves clearance for the bottom nav + the FAB.
            */}
            <main className="mx-auto w-full max-w-[1800px] px-4 py-6 pb-28 sm:px-6 lg:px-10 lg:pb-10">
              {children}
            </main>
            <NewsletterBar />
            <LegalStrip />
            <BottomNav user={user} />
            {/* SmartSearch renders its own desktop launcher (bottom-right) and
                listens for the "upclo:open-search" event from the BottomNav FAB
                on mobile. */}
            <SmartSearch />
            {/* Discreet help-pill in the bottom-right corner that routes to
                /support. Stays out of the way until tapped. */}
            <FloatingSupport />
            {/* Pointer companion — desktop, fine-pointer, motion-allowed only. */}
            <CursorGlow />
          </CurrencyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
