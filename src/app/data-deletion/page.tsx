import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { DeletionForm } from "./DeletionForm";

// Public "how to delete your data" page. The URL Meta asks for under
// "Data Deletion Instructions URL" in the app dashboard:
//   App Dashboard → Settings → Basic → User Data Deletion
//   → Data Deletion Instructions URL = https://streekmart.com/data-deletion
//
// Behaviour:
//   - Signed-in users see a self-serve form: retype email → delete now.
//   - Signed-out users see a clear `mailto:` and instructions to email
//     support from the address on their account.
//
// `noindex` so Google doesn't surface confirmation pages.

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Delete your data · StreekMart",
  description: "How to remove your personal data from StreekMart.",
  robots: { index: false, follow: false },
};

export default async function DataDeletionInstructionsPage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
          Privacy
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold">
          Delete your data
        </h1>
        <p className="mt-2 text-sm text-ink-600">
          You can ask StreekMart to remove your personal data at any time.
          Here&rsquo;s exactly what happens when you do.
        </p>
      </header>

      <section className="card p-6">
        <h2 className="font-display text-lg font-semibold">What we&rsquo;ll delete</h2>
        <ul className="mt-3 space-y-2 text-sm text-ink-700">
          <li>
            • Your account (name, email, phone, business name, profile, bio).
          </li>
          <li>
            • Every product listing, post, look-book, and commission you
            created.
          </li>
          <li>• Your saved addresses and uploaded images.</li>
          <li>
            • Cart, favourites, follows, reviews, and like history.
          </li>
          <li>
            • Chat messages you sent (the other party&rsquo;s copy stays in
            their thread, but yours is gone).
          </li>
          <li>
            • WhatsApp concierge conversation history if you ever chatted
            with us there.
          </li>
          <li>• Push notification tokens for your registered devices.</li>
          <li>• Wallet balance and transaction history.</li>
        </ul>
        <p className="mt-4 text-xs text-ink-500">
          Deletion is immediate and cannot be undone. If you have an active
          wallet balance, withdraw it{" "}
          <Link href="/account/wallet" className="text-violet-700 hover:underline">
            from your wallet
          </Link>{" "}
          first — once the account is gone we can&rsquo;t pay it out.
        </p>
      </section>

      <section className="card p-6">
        <h2 className="font-display text-lg font-semibold">How to request it</h2>
        {user ? (
          <>
            <p className="mt-2 text-sm text-ink-700">
              You&rsquo;re signed in as{" "}
              <span className="font-mono text-violet-800">{user.email}</span>.
              Confirm by retyping your email below and we&rsquo;ll delete
              your account immediately.
            </p>
            <div className="mt-4">
              <DeletionForm expectedEmail={user.email} />
            </div>
          </>
        ) : (
          <div className="mt-2 space-y-3 text-sm text-ink-700">
            <p>
              The fastest path: sign in, come back to this page, and use
              the one-click form that appears here. We do an email match
              against the account on file before deleting anything.
            </p>
            <p>
              If you can&rsquo;t sign in (lost password, deactivated phone),
              email{" "}
              <a
                href="mailto:support@streekmart.com?subject=Data%20deletion%20request"
                className="font-medium text-violet-700 hover:underline"
              >
                support@streekmart.com
              </a>{" "}
              <strong>from the address on your account</strong>. We&rsquo;ll
              verify the request and process it within 7 business days.
            </p>
            <p>
              <Link
                href={`/login?redirect=${encodeURIComponent("/data-deletion")}`}
                className="btn-primary inline-flex text-sm"
              >
                Sign in to delete
              </Link>
            </p>
          </div>
        )}
      </section>

      <section className="card border-amber-200 bg-amber-50/40 p-6">
        <h2 className="font-display text-lg font-semibold">What we have to keep</h2>
        <p className="mt-2 text-sm text-ink-700">
          We retain anonymised, aggregate metrics (e.g. &ldquo;orders per
          month&rdquo; counts) and any record that we&rsquo;re required to
          keep by law — e.g. an order receipt your buyer needs for tax,
          or a payout record we have to surface to our payment processor.
          These records don&rsquo;t identify you by name after deletion.
        </p>
      </section>

      <p className="text-center text-xs text-ink-500">
        Questions? Email{" "}
        <a
          href="mailto:support@streekmart.com"
          className="text-violet-700 hover:underline"
        >
          support@streekmart.com
        </a>{" "}
        or read the{" "}
        <Link href="/privacy-policy" className="text-violet-700 hover:underline">
          privacy policy
        </Link>
        .
      </p>
    </div>
  );
}
