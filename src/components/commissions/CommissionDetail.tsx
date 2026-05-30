"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CommissionStatus,
  commissionStatusChipClass,
  commissionStatusLabel,
  nextStatesFor,
  type CommissionActor,
  type CommissionStatusValue,
} from "@/lib/commissions";

type CommissionShape = {
  id: string;
  status: string;
  title: string;
  description: string;
  occasion: string | null;
  budgetCents: number | null;
  deadlineAt: string | null;
  references: string[];
  quoteCents: number | null;
  quoteNote: string | null;
  quotedAt: string | null;
  estimatedDays: number | null;
  deliveryCode: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  buyer: { id: string; name: string };
  designer: { id: string; name: string };
};

// Shared detail-page renderer. Mounted at /account/commissions/[id] and
// /designer/commissions/[id] — same UI from both sides, differs only in
// which actor-keyed actions are surfaced. The server-fetched commission +
// the viewer's actor role are the only inputs.
export function CommissionDetail({
  initialCommission,
  actor,
}: {
  initialCommission: CommissionShape;
  actor: CommissionActor;
}) {
  const router = useRouter();
  const [c, setC] = useState(initialCommission);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Designer quote inputs (only used when actor=designer + status=REQUESTED).
  const [quote, setQuote] = useState<number | "">("");
  const [estimatedDays, setEstimatedDays] = useState<number | "">("");
  const [quoteNote, setQuoteNote] = useState("");

  // Buyer confirm input (only used when actor=buyer + status=DELIVERED).
  const [code, setCode] = useState("");

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/commissions/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't update.");
        return;
      }
      // Reshape the server reply into the existing UI shape.
      setC((prev) => ({
        ...prev,
        ...data.commission,
        createdAt:
          typeof data.commission.createdAt === "string"
            ? data.commission.createdAt
            : prev.createdAt,
        deadlineAt:
          typeof data.commission.deadlineAt === "string"
            ? data.commission.deadlineAt
            : prev.deadlineAt,
        quotedAt:
          typeof data.commission.quotedAt === "string"
            ? data.commission.quotedAt
            : prev.quotedAt,
        deliveredAt:
          typeof data.commission.deliveredAt === "string"
            ? data.commission.deliveredAt
            : prev.deliveredAt,
        completedAt:
          typeof data.commission.completedAt === "string"
            ? data.commission.completedAt
            : prev.completedAt,
      }));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const nextStates = nextStatesFor(c.status, actor);
  const counterpart = actor === "buyer" ? c.designer : c.buyer;
  const showQuoteForm =
    actor === "designer" && c.status === CommissionStatus.REQUESTED;
  const showConfirmForm =
    actor === "buyer" && c.status === CommissionStatus.DELIVERED;
  const showDeliverButton =
    actor === "designer" && c.status === CommissionStatus.IN_PROGRESS;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={actor === "buyer" ? "/account/commissions" : "/designer/commissions"}
        className="text-sm text-violet-700 hover:underline"
      >
        ← All commissions
      </Link>

      {/* Header */}
      <header className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
              {actor === "buyer" ? "Commission with" : "Commission from"}{" "}
              {counterpart.name}
            </p>
            <h1 className="mt-1 break-words font-display text-2xl font-bold">
              {c.title}
            </h1>
          </div>
          <span className={`badge ${commissionStatusChipClass(c.status)}`}>
            {commissionStatusLabel(c.status)}
          </span>
        </div>
      </header>

      {/* Brief */}
      <section className="card p-6">
        <h2 className="font-display text-lg font-semibold">Brief</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {c.occasion && (
            <Field label="Occasion" value={c.occasion} />
          )}
          {c.deadlineAt && (
            <Field
              label="Deadline"
              value={new Date(c.deadlineAt).toLocaleDateString("en-NG", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            />
          )}
          {c.budgetCents !== null && c.budgetCents !== undefined && (
            <Field
              label="Buyer budget"
              value={`₦${(c.budgetCents / 100).toLocaleString("en-NG")}`}
            />
          )}
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm text-ink-700">
          {c.description}
        </p>
        {c.references.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
              References
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {c.references.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="aspect-square w-full rounded-md bg-ink-100 object-cover"
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Quote */}
      {c.quoteCents !== null && (
        <section className="card border-violet-200 bg-violet-50/60 p-6">
          <h2 className="font-display text-lg font-semibold">Quote</h2>
          <p className="mt-2 text-2xl font-bold text-violet-900">
            ₦{(c.quoteCents / 100).toLocaleString("en-NG")}
          </p>
          {c.estimatedDays && (
            <p className="text-xs text-violet-700">
              Estimated {c.estimatedDays} day{c.estimatedDays === 1 ? "" : "s"} to deliver
            </p>
          )}
          {c.quoteNote && (
            <p className="mt-3 whitespace-pre-wrap text-sm text-ink-700">{c.quoteNote}</p>
          )}
        </section>
      )}

      {/* Designer: send a quote */}
      {showQuoteForm && (
        <section className="card p-6">
          <h2 className="font-display text-lg font-semibold">Send your quote</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Price (NGN)</label>
              <input
                type="number"
                className="input"
                value={quote}
                onChange={(e) => {
                  const v = e.target.value;
                  setQuote(v === "" ? "" : Number(v));
                }}
                min={1}
                step={500}
                placeholder="80000"
              />
            </div>
            <div>
              <label className="label">Estimated days</label>
              <input
                type="number"
                className="input"
                value={estimatedDays}
                onChange={(e) => {
                  const v = e.target.value;
                  setEstimatedDays(v === "" ? "" : Number(v));
                }}
                min={1}
                placeholder="14"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="label">Note (optional)</label>
            <textarea
              className="input min-h-[80px]"
              value={quoteNote}
              onChange={(e) => setQuoteNote(e.target.value)}
              maxLength={1000}
              placeholder="What's included, fabric options, deposit terms…"
            />
          </div>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => patch({ kind: "TRANSITION", to: "DECLINED" })}
              disabled={busy}
            >
              Decline
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || quote === "" || Number(quote) <= 0}
              onClick={() =>
                patch({
                  kind: "QUOTE",
                  quoteCents: Number(quote) * 100,
                  estimatedDays: estimatedDays === "" ? undefined : Number(estimatedDays),
                  quoteNote: quoteNote || undefined,
                })
              }
            >
              Send quote
            </button>
          </div>
        </section>
      )}

      {/* Buyer: confirm delivery */}
      {showConfirmForm && (
        <section className="card p-6">
          <h2 className="font-display text-lg font-semibold">Confirm delivery</h2>
          <p className="mt-1 text-sm text-ink-500">
            Enter the 6-digit code the designer sent you. This releases the payment.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="input max-w-[140px] text-center text-lg tracking-[0.4em]"
            />
            <button
              type="button"
              className="btn-primary"
              disabled={busy || code.length !== 6}
              onClick={() => patch({ kind: "CONFIRM", code })}
            >
              Confirm
            </button>
          </div>
        </section>
      )}

      {/* Generic transitions */}
      {(showDeliverButton || nextStates.length > 0) && (
        <section className="card p-6">
          <h2 className="font-display text-lg font-semibold">Actions</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {showDeliverButton && (
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => patch({ kind: "DELIVER" })}
              >
                Mark delivered
              </button>
            )}
            {nextStates
              // The big quote/deliver/confirm actions have their own UI above
              // — exclude them from the generic transition strip so we don't
              // render a duplicate button.
              .filter(
                (s) =>
                  !(s === CommissionStatus.QUOTED) &&
                  !(s === CommissionStatus.DELIVERED) &&
                  !(s === CommissionStatus.COMPLETED),
              )
              .map((state) => (
                <button
                  key={state}
                  type="button"
                  className={
                    state === CommissionStatus.ACCEPTED ||
                    state === CommissionStatus.IN_PROGRESS
                      ? "btn-primary"
                      : "btn-secondary"
                  }
                  disabled={busy}
                  onClick={() => patch({ kind: "TRANSITION", to: state })}
                >
                  {transitionButtonLabel(state as CommissionStatusValue)}
                </button>
              ))}
          </div>
        </section>
      )}

      {/* Delivery code (designer view) */}
      {actor === "designer" && c.deliveryCode && c.status === CommissionStatus.DELIVERED && (
        <section className="card border-emerald-200 bg-emerald-50/60 p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Delivery code
          </p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-[0.4em]">
            {c.deliveryCode}
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            Share this with the buyer when handing over the piece.
          </p>
        </section>
      )}

      {(c.status === CommissionStatus.DECLINED ||
        c.status === CommissionStatus.CANCELLED) &&
        c.cancellationReason && (
          <section className="card border-ink-200 bg-ink-50/60 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
              {c.status === CommissionStatus.DECLINED ? "Decline note" : "Cancel reason"}
            </p>
            <p className="mt-1 text-sm text-ink-700">{c.cancellationReason}</p>
          </section>
        )}

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
        {label}
      </p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function transitionButtonLabel(state: CommissionStatusValue): string {
  switch (state) {
    case CommissionStatus.ACCEPTED:
      return "Accept quote";
    case CommissionStatus.IN_PROGRESS:
      return "Start work";
    case CommissionStatus.DECLINED:
      return "Decline";
    case CommissionStatus.CANCELLED:
      return "Cancel";
    default:
      return state;
  }
}
