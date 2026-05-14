"use client";

import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/utils";

type Req = {
  id: string;
  kind: "SELLER" | "DESIGNER";
  status: "PENDING" | "APPROVED" | "REJECTED";
  notes: string | null;
  decisionNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export function VerificationPanel({
  kind,
  alreadyVerified,
}: {
  kind: "SELLER" | "DESIGNER";
  alreadyVerified: boolean;
}) {
  const [requests, setRequests] = useState<Req[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/verifications");
    if (res.ok) {
      const data = await res.json();
      setRequests(
        (data.requests as Req[]).filter((r) => r.kind === kind),
      );
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  const pending = requests?.find((r) => r.status === "PENDING");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, notes: notes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't submit.");
        return;
      }
      setNotes("");
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {alreadyVerified ? (
        <div className="card flex items-center gap-3 p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-accent text-lg text-white">✓</span>
          <div>
            <p className="font-display text-base font-semibold">You&apos;re verified.</p>
            <p className="text-xs text-ink-500">A check mark shows next to your name across StreekMart.</p>
          </div>
        </div>
      ) : pending ? (
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
            Pending review
          </p>
          <p className="mt-1 text-sm">
            Submitted {timeAgo(pending.createdAt)}. We&apos;ll let you know when an admin
            takes a look.
          </p>
          {pending.notes && <p className="mt-2 text-xs text-ink-500">Your note: &ldquo;{pending.notes}&rdquo;</p>}
        </div>
      ) : (
        <form onSubmit={submit} className="card space-y-3 p-5">
          <h3 className="font-display text-base font-semibold">Request a verified badge</h3>
          <p className="text-xs text-ink-500">
            Tell admins who you are and where buyers can confirm you&apos;re real
            (a public store URL, social handle, press mention, etc.). Admins
            review manually.
          </p>
          <textarea
            className="input min-h-[120px] text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. https://instagram.com/mylabel · I'm the founder, here are recent press features…"
          />
          {err && <p className="text-sm text-burgundy-700">{err}</p>}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Submitting…" : "Submit request"}
          </button>
        </form>
      )}

      {/* Past decisions */}
      {requests && requests.length > 0 && (
        <section className="card overflow-hidden">
          <header className="border-b border-ink-100 p-4">
            <h3 className="font-display text-base font-semibold">History</h3>
          </header>
          <ul className="divide-y divide-ink-100">
            {requests.map((r) => (
              <li key={r.id} className="p-4 text-sm">
                <p className="font-medium">
                  {r.status === "APPROVED" && <span className="text-emerald-accent">Approved</span>}
                  {r.status === "REJECTED" && <span className="text-burgundy-700">Rejected</span>}
                  {r.status === "PENDING" && <span className="text-amber-700">Pending</span>}
                  <span className="ml-2 text-xs text-ink-500">· {timeAgo(r.createdAt)}</span>
                </p>
                {r.decisionNote && <p className="mt-1 text-xs text-ink-500">Note: {r.decisionNote}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
