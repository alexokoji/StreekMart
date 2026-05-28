"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Audience = "ALL" | "BUYERS" | "SELLERS" | "DESIGNERS" | "VERIFIED" | "SPECIFIC" | "EMAILS";

const AUDIENCES: { value: Audience; label: string; help: string }[] = [
  { value: "ALL", label: "Everyone", help: "Every account on the platform." },
  { value: "BUYERS", label: "Buyers only", help: "Accounts that aren't sellers or designers." },
  { value: "SELLERS", label: "Sellers", help: "Anyone with the Seller permission." },
  { value: "DESIGNERS", label: "Designers", help: "Anyone with the Designer permission." },
  { value: "VERIFIED", label: "Verified accounts", help: "Verified sellers or designers." },
  { value: "SPECIFIC", label: "Specific users (by ID)", help: "Paste a comma-separated list of user IDs." },
  { value: "EMAILS", label: "Specific addresses (by email)", help: "Paste a comma- or newline-separated list of email addresses. Non-users still receive the email." },
];

export function BroadcastForm() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("ALL");
  const [specificIds, setSpecificIds] = useState("");
  const [specificEmails, setSpecificEmails] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [failures, setFailures] = useState<{ email: string; error: string }[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!confirm(`Send "${subject}" to the selected audience?`)) return;
    setBusy(true);
    try {
      const ids =
        audience === "SPECIFIC"
          ? specificIds
              .split(/[\s,]+/)
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined;
      const emails =
        audience === "EMAILS"
          ? specificEmails
              .split(/[\s,;]+/)
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined;
      const res = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          body,
          audience,
          specificIds: ids,
          specificEmails: emails,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: "err", text: data.error ?? "Couldn't send." });
        setFailures([]);
        return;
      }
      setMsg({
        kind: data.status === "SENT" ? "ok" : "err",
        text: `${data.status}: ${data.sentCount} / ${data.recipientCount} delivered.`,
      });
      setFailures(Array.isArray(data.failures) ? data.failures : []);
      // Only reset the form when every send succeeded — otherwise the
      // admin probably wants to copy the failed addresses and retry.
      if (data.status === "SENT") {
        setSubject("");
        setBody("");
        setSpecificIds("");
        setSpecificEmails("");
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <div>
        <label className="label">Subject</label>
        <input
          className="input"
          required
          minLength={2}
          maxLength={200}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Holiday promotions are live"
        />
      </div>
      <div>
        <label className="label">Body</label>
        <textarea
          className="input min-h-[180px] font-mono text-sm"
          required
          minLength={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="HTML allowed. Use <p>, <a>, <strong>. Keep it short."
        />
        <p className="mt-1 text-[11px] text-ink-500">
          Your body is wrapped in the StreekMart email template (header + footer).
        </p>
      </div>

      <div>
        <label className="label">Audience</label>
        <select
          className="input"
          value={audience}
          onChange={(e) => setAudience(e.target.value as Audience)}
        >
          {AUDIENCES.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-ink-500">
          {AUDIENCES.find((a) => a.value === audience)?.help}
        </p>
      </div>

      {audience === "SPECIFIC" && (
        <div>
          <label className="label">User IDs</label>
          <textarea
            className="input min-h-[80px] font-mono text-xs"
            value={specificIds}
            onChange={(e) => setSpecificIds(e.target.value)}
            placeholder="cuid1, cuid2, cuid3 (comma or whitespace separated)"
          />
        </div>
      )}

      {audience === "EMAILS" && (
        <div>
          <label className="label">Email addresses</label>
          <textarea
            className="input min-h-[100px] font-mono text-xs"
            value={specificEmails}
            onChange={(e) => setSpecificEmails(e.target.value)}
            placeholder={"jane@example.com\nalex@partner.co\n— comma, semicolon, or newline separated"}
          />
          <p className="mt-1 text-[11px] text-ink-500">
            Addresses that match an existing user will be linked in the audit log.
            Addresses that don&apos;t still receive the email.
          </p>
        </div>
      )}

      {msg && (
        <p
          className={`text-sm ${
            msg.kind === "ok" ? "text-emerald-accent" : "text-burgundy-700"
          }`}
        >
          {msg.text}
        </p>
      )}

      {failures.length > 0 && (
        <details className="rounded-lg border border-burgundy-200 bg-burgundy-50/40 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-burgundy-700">
            {failures.length} address{failures.length === 1 ? "" : "es"} failed — show details
          </summary>
          <ul className="mt-3 space-y-1.5 text-xs">
            {failures.map((f, i) => (
              <li key={`${f.email}-${i}`} className="break-all">
                <span className="font-mono text-ink-700">{f.email}</span>
                <span className="ml-2 text-burgundy-600">{f.error}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-3 text-xs text-violet-600 underline"
            onClick={() => {
              setAudience("EMAILS");
              setSpecificEmails(failures.map((f) => f.email).join("\n"));
              setFailures([]);
              setMsg({ kind: "ok", text: "Failed addresses loaded — adjust subject/body if you like, then re-send." });
            }}
          >
            Reload failed addresses into the form to retry
          </button>
        </details>
      )}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Sending…" : "Send broadcast"}
        </button>
      </div>
    </form>
  );
}
