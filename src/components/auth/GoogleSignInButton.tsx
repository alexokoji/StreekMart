"use client";

// "Sign in with Google" CTA. Renders as a real <a> so the browser does a
// top-level navigation to /api/auth/google/start — the route then redirects
// to Google. We pass the user's role selection through the start endpoint
// because Google has no concept of StreekMart's permission flags.
export function GoogleSignInButton({
  intent,
  isSeller,
  isDesigner,
  redirect,
  label,
}: {
  intent: "login" | "signup";
  isSeller?: boolean;
  isDesigner?: boolean;
  redirect?: string;
  label?: string;
}) {
  const params = new URLSearchParams({ intent });
  if (isSeller) params.set("isSeller", "1");
  if (isDesigner) params.set("isDesigner", "1");
  if (redirect) params.set("redirect", redirect);

  return (
    <a
      href={`/api/auth/google/start?${params.toString()}`}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-800 transition hover:bg-ink-50"
    >
      <GoogleGlyph />
      {label ?? (intent === "signup" ? "Sign up with Google" : "Sign in with Google")}
    </a>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.1C29.2 35.4 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.7 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.2 5.1C40.9 35.3 44 30 44 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  );
}
