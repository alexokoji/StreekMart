"use client";

import { useState } from "react";

// Contact form for the /support page. We don't have a ticketing backend
// yet, so the form composes a mailto: link with the subject + body
// pre-filled. The user's mail client opens, they hit Send, and the email
// lands in the same support@ inbox. Cheap, reliable, and zero new
// infrastructure to maintain.
//
// When a real ticketing system is added (Linear / Zendesk / etc.), swap
// the onSubmit body for a POST to /api/support/ticket and keep the rest.

const TOPICS = [
  "Order help",
  "Payments & wallet",
  "Verification",
  "Listings / products",
  "Bug report",
  "Feature request",
  "Account / login",
  "Something else",
] as const;

export function SupportForm({
  defaultEmail,
  defaultName,
}: {
  defaultEmail: string;
  defaultName: string;
}) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>("Order help");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const subject = `[${topic}] StreekMart support — ${name || "anonymous"}`;
    const lines = [
      `From: ${name || "(no name)"} <${email || "(no email)"}>`,
      `Topic: ${topic}`,
      "",
      body,
    ].join("\n");
    // mailto: works on every desktop + mobile platform. iOS / Android open
    // the system mail client; desktop opens whatever's set as the handler.
    const href = `mailto:support@streekmart.online?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines)}`;
    window.location.href = href;
    setSent(true);
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Your name</label>
          <input
            type="text"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada"
            autoComplete="name"
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </div>
      </div>

      <div>
        <label className="label">Topic</label>
        <select
          className="input"
          value={topic}
          onChange={(e) => setTopic(e.target.value as (typeof TOPICS)[number])}
        >
          {TOPICS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">What&rsquo;s going on?</label>
        <textarea
          className="input min-h-[120px]"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Tell us what happened. If it's about an order, include the order ID from the URL."
          required
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-500">
          We&rsquo;ll reply to <span className="font-medium">{email || "your email"}</span> within one business day.
        </p>
        <button type="submit" className="btn-primary">
          {sent ? "Open mail again" : "Send message"}
        </button>
      </div>
    </form>
  );
}
