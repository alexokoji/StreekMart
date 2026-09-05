import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { SupportForm } from "./SupportForm";

// Public support page. Reachable from the floating "?" button in the
// bottom-right corner (FloatingSupport.tsx) and from any legal-page
// "contact us" link. Renders an FAQ, a direct email path, and a contact
// form that opens a ticket in the user's mail client (mailto:) — keeps the
// surface small until a real ticketing system exists.

export const metadata = {
  title: "Support · StreekMart",
};

export default async function SupportPage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
          Help & support
        </p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">
          We&rsquo;re here to help.
        </h1>
        <p className="text-sm text-ink-600 sm:text-base">
          Most questions are answered below. If you need a human, email us
          directly or send a message through the form &mdash; we read every
          one and reply within one business day.
        </p>
      </header>

      <section className="card p-6">
        <h2 className="font-display text-xl font-semibold">Quick links</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          <SupportLink href="/account" title="My account" desc="Update profile, address, and password." gated={!user} />
          <SupportLink href="/account/orders" title="My orders" desc="Track deliveries and confirmation codes." gated={!user} />
          <SupportLink href="/seller" title="Seller dashboard" desc="Listings, payouts, wallet, verification." gated={!user} />
          <SupportLink href="/designer" title="Designer studio" desc="Posts, products, Sketch Studio, follows." gated={!user} />
          <SupportLink href="/terms-and-conditions" title="Terms & Conditions" desc="Platform rules and fees." />
          <SupportLink href="/privacy-policy" title="Privacy policy" desc="What we store and why." />
        </ul>
      </section>

      <section className="card p-6">
        <h2 className="font-display text-xl font-semibold">Frequent questions</h2>
        <div className="mt-4 space-y-4">
          <Faq
            q="Where&rsquo;s my order?"
            a={`Open My orders, tap the order, and you'll see live delivery updates from the seller. Every order also has a delivery code you'll share with the rider on arrival. If the code is blank, payment hasn't cleared yet.`}
          />
          <Faq
            q="A buyer paid but I (the seller) haven&rsquo;t been credited."
            a={`Wallet credit clears once the buyer confirms delivery with the delivery code OR after the delivery window elapses (14 days from payment). Until then, your share sits in escrow on the order row.`}
          />
          <Faq
            q="How do I get the blue check / gold check?"
            a={`Submit Tier 2 verification (NIN, Passport, or Driver's License) from your seller or designer dashboard for the blue check. Tier 3 (gold) adds CAC documents and lifts your listing cap to 100 and your withdrawal fee to 1.5%.`}
          />
          <Faq
            q="My buyer wants a colour / size I didn&rsquo;t list."
            a={`Add it to the product's Variants panel from the edit page — the picker shows up on the product page and on the order, so you know exactly what to pack.`}
          />
          <Faq
            q="I downloaded the Android APK but it won&rsquo;t install."
            a={`On Android, allow installs from unknown sources for your browser (Settings → Apps → Browser → Install unknown apps). Once installed, future updates push themselves over-the-air automatically.`}
          />
          <Faq
            q="Can I delete my account?"
            a={`Email support@streekmart.com from the address on file. We honour deletion requests within 7 days; outstanding orders are settled first.`}
          />
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-display text-xl font-semibold">Reach a human</h2>
        <p className="mt-2 text-sm text-ink-600">
          Email{" "}
          <a className="font-medium text-violet-700 hover:underline" href="mailto:support@streekmart.com">
            support@streekmart.com
          </a>{" "}
          for anything urgent. For non-urgent feedback or feature requests, use
          the form below — it composes the email for you with the right
          subject line so it lands in the right inbox.
        </p>
        <div className="mt-4">
          <SupportForm
            defaultEmail={user?.email ?? ""}
            defaultName={user?.name ?? ""}
          />
        </div>
      </section>

      <p className="text-center text-xs text-ink-500">
        <Link href="/" className="hover:underline">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}

function SupportLink({
  href,
  title,
  desc,
  gated,
}: {
  href: string;
  title: string;
  desc: string;
  gated?: boolean;
}) {
  // When the user isn't signed in we still show account/dashboard links but
  // route them through /login with a redirect so they land on the right
  // page after authenticating.
  const finalHref = gated
    ? `/login?redirect=${encodeURIComponent(href)}`
    : href;
  return (
    <li>
      <Link
        href={finalHref}
        className="block rounded-xl border border-ink-100 p-4 transition hover:border-violet-300 hover:bg-violet-50/40"
      >
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-ink-500">{desc}</p>
      </Link>
    </li>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  // <details> gives us collapsible behaviour without any JS — the FAQ
  // section stays light even when the list grows.
  return (
    <details className="rounded-xl border border-ink-100 p-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium">
        <span className="flex-1">{q}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="shrink-0 text-ink-400 transition-transform duration-200 group-open:rotate-180"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-ink-600">{a}</p>
    </details>
  );
}
