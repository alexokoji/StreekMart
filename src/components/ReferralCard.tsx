"use client";

import { useState } from "react";

// Buyer-facing referral card. Shows the user's code, current points
// balance, and a one-tap copy-link affordance. Used on /account, the
// seller dashboard, and the designer dashboard.
export function ReferralCard({
  code,
  pointsBalance,
  referralCount,
  siteUrl,
}: {
  code: string;
  pointsBalance: number;
  referralCount: number;
  siteUrl: string;
}) {
  const link = `${siteUrl.replace(/\/$/, "")}/register?ref=${code}`;
  const [copied, setCopied] = useState<"none" | "code" | "link">("none");

  async function copy(value: string, kind: "code" | "link") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied("none"), 1500);
    } catch {
      // Older browsers — silently fall through; user can long-press text.
    }
  }

  async function share() {
    const data = {
      title: "Join StreekMart",
      text: `Use my code ${code} to sign up:`,
      url: link,
    };
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share(data);
        return;
      } catch {
        /* user cancelled or share failed — fall through */
      }
    }
    await copy(link, "link");
  }

  return (
    <section className="card overflow-hidden p-0">
      <div className="bg-gradient-to-br from-violet-600 via-fuchsia-500 to-gold-400 p-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
          Refer a friend
        </p>
        <div className="mt-1 flex flex-wrap items-baseline gap-3">
          <span className="font-display text-3xl font-bold">{pointsBalance.toLocaleString()}</span>
          <span className="text-sm text-white/90">points</span>
        </div>
        <p className="mt-1 text-xs text-white/85">
          {referralCount === 0
            ? "You haven't referred anyone yet. Share your code below."
            : `${referralCount} friend${referralCount === 1 ? "" : "s"} joined via your code`}
        </p>
      </div>

      <div className="space-y-3 p-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">
            Your code
          </p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 truncate rounded-md bg-ink-50 px-3 py-2 font-mono text-lg font-bold tracking-[0.18em]">
              {code}
            </code>
            <button
              type="button"
              onClick={() => copy(code, "code")}
              className="btn-secondary text-xs"
            >
              {copied === "code" ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">
            Or share the link
          </p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 truncate rounded-md bg-ink-50 px-3 py-2 text-xs text-ink-700">
              {link}
            </code>
            <button type="button" onClick={share} className="btn-primary text-xs">
              {copied === "link" ? "Copied" : "Share"}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-ink-500">
          You earn points each time someone signs up with your code &mdash; and a bigger bonus when they complete their first order.
        </p>
      </div>
    </section>
  );
}
