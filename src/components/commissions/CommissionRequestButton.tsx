"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Floating CTA on a designer's public profile that opens a commission brief
// modal. Authenticated buyers only; the parent decides whether to render it
// (e.g. hide when viewing your own profile).
export function CommissionRequestButton({
  designerId,
  designerName,
}: {
  designerId: string;
  designerName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [occasion, setOccasion] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState<number | "">("");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          designerId,
          title,
          description,
          occasion: occasion || undefined,
          budgetCents: budget === "" ? undefined : Number(budget) * 100,
          deadlineAt: deadline ? new Date(deadline).toISOString() : undefined,
        }),
      });
      if (res.status === 401) {
        router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't send.");
        return;
      }
      router.push(`/account/commissions/${data.commission.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        Request a commission
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/50 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
                  Custom commission
                </p>
                <h2 className="mt-0.5 font-display text-xl font-bold">
                  Brief {designerName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-full p-1.5 text-ink-500 hover:bg-ink-50"
              >
                ×
              </button>
            </div>
            <form onSubmit={submit} className="mt-4 space-y-3">
              <div>
                <label className="label">What do you want made?</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input"
                  required
                  minLength={3}
                  maxLength={120}
                  placeholder="e.g. Aso Ebi gown for sister's wedding"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Occasion (optional)</label>
                  <input
                    type="text"
                    value={occasion}
                    onChange={(e) => setOccasion(e.target.value)}
                    className="input"
                    maxLength={60}
                    placeholder="Wedding, Birthday…"
                  />
                </div>
                <div>
                  <label className="label">Deadline (optional)</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="input"
                  />
                </div>
              </div>
              <div>
                <label className="label">Tell us more</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input min-h-[120px]"
                  required
                  minLength={8}
                  maxLength={2000}
                  placeholder="Colour, style refs, measurements you already know, fabric preferences."
                />
              </div>
              <div>
                <label className="label">Budget (NGN, optional)</label>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => {
                    const v = e.target.value;
                    setBudget(v === "" ? "" : Number(v));
                  }}
                  className="input"
                  min={0}
                  step={1000}
                  placeholder="50000"
                />
                <p className="mt-1 text-[11px] text-ink-500">
                  Optional. The designer quotes back; you can negotiate before accepting.
                </p>
              </div>
              {err && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {err}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-secondary"
                  disabled={busy}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={busy}>
                  {busy ? "Sending…" : "Send brief"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
