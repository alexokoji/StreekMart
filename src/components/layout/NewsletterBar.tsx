"use client";

import { useState } from "react";

// Full-bleed subscribe bar between the page content and the footer —
// same structural slot most fashion-marketplace sites use for the "join
// our community" email capture. Posts to /api/newsletter if it exists;
// falls back to a friendly confirmation either way so the bar never
// blocks on backend wiring.
export function NewsletterBar() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("busy");
    try {
      await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }).catch(() => {});
    } finally {
      setState("done");
    }
  }

  return (
    <div className="bg-ink-900 text-white dark:bg-black">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col items-center gap-4 px-6 py-8 text-center sm:flex-row sm:justify-between sm:text-left lg:px-10">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
            <MailIcon />
          </span>
          <div>
            <p className="font-display text-base font-semibold sm:text-lg">Join our fashion community</p>
            <p className="text-xs text-ink-300">Be the first to know about new arrivals, exclusive deals, and more.</p>
          </div>
        </div>

        {state === "done" ? (
          <p className="text-sm font-medium text-gold-300">You&rsquo;re on the list — thanks!</p>
        ) : (
          <form onSubmit={onSubmit} className="flex w-full max-w-sm gap-2 sm:w-auto">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              className="w-full rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-ink-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            />
            <button
              type="submit"
              disabled={state === "busy"}
              className="btn-gold shrink-0 whitespace-nowrap px-4 py-2.5 text-sm"
            >
              {state === "busy" ? "…" : "Subscribe"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}
