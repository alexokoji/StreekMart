import Link from "next/link";
import { headers } from "next/headers";

// /verify-email?token=…
//
// Landing page hit by the link in the verification email. We perform the
// verification server-side here (one GET to /api/auth/verify-email) so the
// outcome renders in the initial HTML — no JS-only spinner state, no
// re-render flicker, and email clients that prefetch the link don't burn
// the token because the prefetch hits the same endpoint our render does
// (and either way the token is marked used). Note: some email clients
// (Outlook security scanners) pre-click links — that means an unverified
// user might land here later and see "already verified", which is fine.
//
// We don't `redirect()` after success because the user is often logged-in
// in a different browser session (the one they opened the email in vs.
// the one they signed up in). A clear success state + a "go home" button
// is the friendliest landing.

export const dynamic = "force-dynamic";

async function callVerify(token: string): Promise<
  | { ok: true; email: string; alreadyVerified?: boolean }
  | { ok: false; error: string }
> {
  // Build the same-origin URL the request was served from so this works
  // identically on prod, preview, and localhost without depending on
  // NEXT_PUBLIC_APP_URL being set correctly.
  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;
  try {
    const res = await fetch(
      `${origin}/api/auth/verify-email?token=${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );
    const data = (await res.json()) as
      | { ok: true; email: string; alreadyVerified?: boolean }
      | { ok: false; error: string };
    return data;
  } catch {
    return { ok: false, error: "We couldn't reach the verification service. Try again in a minute." };
  }
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token?.trim();
  if (!token) {
    return (
      <Outcome
        kind="error"
        title="Missing token"
        body="This page expects a verification token. Open the link in the email we sent you instead."
      />
    );
  }

  const result = await callVerify(token);
  if (result.ok) {
    return (
      <Outcome
        kind="success"
        title={result.alreadyVerified ? "Already verified" : "Email verified"}
        body={
          result.alreadyVerified
            ? `Your email ${result.email} was already confirmed — you can close this tab.`
            : `Thanks for confirming ${result.email}. You'll now receive order updates, delivery codes, and chat replies.`
        }
      />
    );
  }

  return (
    <Outcome
      kind="error"
      title="Couldn't verify"
      body={result.error}
      showResend
    />
  );
}

function Outcome({
  kind,
  title,
  body,
  showResend,
}: {
  kind: "success" | "error";
  title: string;
  body: string;
  showResend?: boolean;
}) {
  return (
    <div className="mx-auto max-w-md py-16">
      <div className="card p-8 text-center">
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
            kind === "success"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {kind === "success" ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-ink-600">{body}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-primary">
            Continue to StreekMart
          </Link>
          {showResend && (
            <p className="basis-full text-xs text-ink-500">
              Signed in? Use the &ldquo;Resend email&rdquo; button in the
              banner at the top of the home page.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
