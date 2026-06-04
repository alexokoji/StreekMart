"use client";

import { useEffect, useState } from "react";
import type {
  CampaignTemplateKey,
} from "@/lib/campaignTemplates";
import type { AudienceSegmentKey } from "@/lib/audienceSegments";

type TemplateRow = {
  key: CampaignTemplateKey;
  title: string;
  audience: string;
  segment: AudienceSegmentKey;
  description: string;
  subject: string;
  body: string;
};

type SegmentRow = {
  key: AudienceSegmentKey;
  label: string;
  description: string;
};

type DryRunResult = {
  recipientCount: number;
  sample: { to: string; subject: string; html: string };
};

// Three-pane editor:
//   - Template gallery on the left (pick the campaign)
//   - Subject + body editor in the middle (overrides allowed)
//   - Audience + preview + send panel on the right
//
// Picking a template prefills the body, the audience, and the editor.
// Changing the audience (e.g. send a buyer template to inactive buyers
// instead of all buyers) is allowed — useful for ad-hoc variants.
export function CampaignBuilder({
  templates,
  segments,
}: {
  templates: TemplateRow[];
  segments: SegmentRow[];
}) {
  const [selectedKey, setSelectedKey] = useState<CampaignTemplateKey | null>(null);
  const [segmentKey, setSegmentKey] = useState<AudienceSegmentKey | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [busy, setBusy] = useState<"preview" | "send" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ sentCount: number; recipientCount: number; status: string } | null>(null);

  const selected = templates.find((t) => t.key === selectedKey) ?? null;

  // When a template is picked, prefill the editor + reset dry-run + clear
  // any prior send result.
  useEffect(() => {
    if (!selected) return;
    setSubject(selected.subject);
    setBody(selected.body);
    setSegmentKey(selected.segment);
    setDryRun(null);
    setSendResult(null);
    setErr(null);
  }, [selected]);

  async function previewRecipients() {
    if (!selectedKey || !segmentKey) return;
    setBusy("preview");
    setErr(null);
    try {
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: selectedKey,
          segment: segmentKey,
          subjectOverride: subject !== selected?.subject ? subject : undefined,
          bodyOverride: body !== selected?.body ? body : undefined,
          dryRun: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Preview failed.");
        return;
      }
      setDryRun({ recipientCount: data.recipientCount, sample: data.sample });
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (!selectedKey || !segmentKey) return;
    if (!dryRun) {
      setErr("Run preview first so you can confirm the recipient count.");
      return;
    }
    if (
      !window.confirm(
        `Send "${subject}" to ${dryRun.recipientCount} recipient${dryRun.recipientCount === 1 ? "" : "s"}?`,
      )
    )
      return;
    setBusy("send");
    setErr(null);
    setSendResult(null);
    try {
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: selectedKey,
          segment: segmentKey,
          subjectOverride: subject !== selected?.subject ? subject : undefined,
          bodyOverride: body !== selected?.body ? body : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Send failed.");
        return;
      }
      setSendResult({
        sentCount: data.sentCount,
        recipientCount: data.recipientCount,
        status: data.status,
      });
      setDryRun(null);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr_22rem]">
      {/* Template gallery */}
      <aside className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-500">
          Templates
        </p>
        <ul className="space-y-2">
          {templates.map((t) => (
            <li key={t.key}>
              <button
                type="button"
                onClick={() => setSelectedKey(t.key)}
                className={`w-full rounded-xl border p-3 text-left text-sm transition ${
                  selectedKey === t.key
                    ? "border-violet-500 bg-violet-50/40"
                    : "border-ink-200 bg-white hover:border-violet-300"
                }`}
              >
                <p className="font-medium">{t.title}</p>
                <p className="mt-0.5 text-xs text-ink-500">{t.audience}</p>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Editor */}
      <section className="min-w-0">
        {!selected ? (
          <div className="card p-10 text-center text-sm text-ink-500">
            Pick a template from the left to start editing.
          </div>
        ) : (
          <div className="card space-y-4 p-5">
            <div>
              <h2 className="font-display text-lg font-semibold">{selected.title}</h2>
              <p className="text-xs text-ink-500">{selected.description}</p>
            </div>

            <div>
              <label className="label">Subject</label>
              <input
                className="input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
              />
            </div>

            <div>
              <label className="label">
                Body (HTML, supports{" "}
                <code className="rounded bg-ink-50 px-1 text-[10px]">{`{{name}}`}</code>{" "}
                and{" "}
                <code className="rounded bg-ink-50 px-1 text-[10px]">{`{{appUrl}}`}</code>)
              </label>
              <textarea
                className="input min-h-[260px] font-mono text-xs"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={20_000}
              />
            </div>

            {(subject !== selected.subject || body !== selected.body) && (
              <p className="text-xs text-amber-700">
                Editing template copy — your changes apply to this send only.
                The template itself is unchanged.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Audience + preview + send */}
      <aside className="space-y-4">
        <div className="card space-y-3 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-500">
            Audience
          </p>
          <select
            className="input"
            value={segmentKey ?? ""}
            onChange={(e) => {
              setSegmentKey(e.target.value as AudienceSegmentKey);
              setDryRun(null);
            }}
            disabled={!selected}
          >
            <option value="">— pick a segment —</option>
            {segments.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          {segmentKey && (
            <p className="text-[11px] text-ink-500">
              {segments.find((s) => s.key === segmentKey)?.description}
            </p>
          )}
          <button
            type="button"
            className="btn-secondary w-full text-xs"
            onClick={previewRecipients}
            disabled={!selected || !segmentKey || busy !== null}
          >
            {busy === "preview" ? "Counting…" : "Preview recipients"}
          </button>
          {dryRun && (
            <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3 text-xs">
              <p>
                <strong>{dryRun.recipientCount}</strong> recipient
                {dryRun.recipientCount === 1 ? "" : "s"}
              </p>
              {dryRun.recipientCount > 0 && (
                <p className="mt-1 text-ink-500">
                  Sample to: <span className="font-mono">{dryRun.sample.to}</span>
                </p>
              )}
            </div>
          )}
        </div>

        <div className="card space-y-3 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-500">
            Send
          </p>
          {err && (
            <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {err}
            </p>
          )}
          {sendResult && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
              {sendResult.status} — sent {sendResult.sentCount}/
              {sendResult.recipientCount}.
            </div>
          )}
          <button
            type="button"
            className="btn-primary w-full"
            onClick={send}
            disabled={!dryRun || dryRun.recipientCount === 0 || busy !== null}
          >
            {busy === "send"
              ? "Sending…"
              : dryRun
                ? `Send to ${dryRun.recipientCount}`
                : "Preview first"}
          </button>
          <p className="text-[11px] text-ink-500">
            Sends pace at 600 ms/email under Resend&rsquo;s free tier (~1.7
            req/s). Large cohorts take a few minutes to finish — the audit
            row updates as it runs.
          </p>
        </div>

        {dryRun && (
          <div className="card space-y-3 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-500">
              Sample render
            </p>
            <p className="text-sm font-semibold">{dryRun.sample.subject}</p>
            <div
              className="prose prose-sm max-w-none rounded-lg border border-ink-100 bg-white p-3 text-xs"
              dangerouslySetInnerHTML={{ __html: dryRun.sample.html }}
            />
          </div>
        )}
      </aside>
    </div>
  );
}
