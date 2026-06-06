"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PreorderStatus,
  preorderStatusChipClass,
  preorderStatusLabel,
  type PreorderActor,
} from "@/lib/preorders";

export type PreorderShape = {
  id: string;
  status: string;
  priceCents: number;
  leadDays: number;
  notes: string | null;
  designPaidAt: string | null;
  estimatedReadyAt: string | null;
  readyAt: string | null;
  deliveryFeeCents: number | null;
  deliveryPaidAt: string | null;
  shippingAddress: string | null;
  trackingCode: string | null;
  logisticsProvider: string | null;
  deliveryCode: string | null;
  shippedAt: string | null;
  completedAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  buyer: { id: string; name: string };
  designer: { id: string; name: string };
  post: { id: string; title: string; coverUrl: string | null } | null;
};

// Shared detail-page renderer. Mounted at /account/preorders/[id] and
// /designer/preorders/[id]. The `actor` prop drives which actions render.
export function PreorderDetail({
  initial,
  actor,
}: {
  initial: PreorderShape;
  actor: PreorderActor;
}) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Delivery payment form (buyer, status=READY)
  const [shippingAddress, setShippingAddress] = useState("");
  const [feeNgn, setFeeNgn] = useState<number | "">("");

  // Ship form (designer, status=AWAITING_SHIPMENT)
  const [trackingCode, setTrackingCode] = useState("");
  const [provider, setProvider] = useState("");

  // Buyer confirm (status=SHIPPED)
  const [confirmCode, setConfirmCode] = useState("");

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/preorders/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't update.");
        return;
      }
      setP((prev) => ({
        ...prev,
        status: data.preorder.status ?? prev.status,
        readyAt: data.preorder.readyAt ?? prev.readyAt,
        trackingCode: data.preorder.trackingCode ?? prev.trackingCode,
        logisticsProvider: data.preorder.logisticsProvider ?? prev.logisticsProvider,
        deliveryCode: data.preorder.deliveryCode ?? prev.deliveryCode,
        shippedAt: data.preorder.shippedAt ?? prev.shippedAt,
        completedAt: data.preorder.completedAt ?? prev.completedAt,
        cancellationReason: data.preorder.cancellationReason ?? prev.cancellationReason,
      }));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function payDelivery() {
    if (!shippingAddress.trim() || feeNgn === "" || feeNgn <= 0) {
      setErr("Add an address and a delivery fee.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/preorders/${p.id}/pay-delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingAddress,
          feeCents: Math.round(Number(feeNgn) * 100),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't start delivery payment.");
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
    } finally {
      setBusy(false);
    }
  }

  const counterpart = actor === "buyer" ? p.designer : p.buyer;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={actor === "buyer" ? "/account/preorders" : "/designer/preorders"}
        className="text-sm text-violet-700 hover:underline"
      >
        ← All preorders
      </Link>

      {/* Header */}
      <header className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
              {actor === "buyer" ? "Preorder with" : "Preorder from"}{" "}
              {counterpart.name}
            </p>
            <h1 className="mt-1 break-words font-display text-2xl font-bold">
              {p.post?.title ?? "(post removed)"}
            </h1>
          </div>
          <span className={`badge ${preorderStatusChipClass(p.status)}`}>
            {preorderStatusLabel(p.status)}
          </span>
        </div>
      </header>

      {/* Money + timing */}
      <section className="card p-5">
        <h2 className="font-display text-lg font-semibold">Details</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Design price" value={`₦${(p.priceCents / 100).toLocaleString("en-NG")}`} />
          <Field label="Lead time" value={`${p.leadDays} day${p.leadDays === 1 ? "" : "s"}`} />
          {p.estimatedReadyAt && (
            <Field
              label="Estimated ready"
              value={new Date(p.estimatedReadyAt).toLocaleDateString("en-NG", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            />
          )}
          {p.deliveryFeeCents != null && (
            <Field
              label="Delivery fee"
              value={`₦${(p.deliveryFeeCents / 100).toLocaleString("en-NG")}`}
            />
          )}
        </dl>
        {p.notes && (
          <p className="mt-4 max-w-2xl whitespace-pre-wrap text-sm text-ink-700">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-500">
              Buyer notes:
            </span>{" "}
            {p.notes}
          </p>
        )}
      </section>

      {/* Buyer: pay delivery (status=READY) */}
      {actor === "buyer" && p.status === PreorderStatus.READY && (
        <section className="card border-sky-200 bg-sky-50/40 p-5">
          <h2 className="font-display text-lg font-semibold">Pay for delivery</h2>
          <p className="mt-1 text-sm text-ink-600">
            The piece is ready. Add a shipping address and the courier quote
            from your messages to pay delivery and get it shipped.
          </p>
          <div className="mt-3 grid gap-3">
            <div>
              <label className="label">Shipping address</label>
              <textarea
                className="input min-h-[60px] text-sm"
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder="Street, area, city, postcode"
              />
            </div>
            <div>
              <label className="label">Delivery fee (NGN)</label>
              <input
                type="number"
                className="input"
                value={feeNgn}
                onChange={(e) => {
                  const v = e.target.value;
                  setFeeNgn(v === "" ? "" : Number(v));
                }}
                min={100}
                step={100}
                placeholder="2500"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" className="btn-primary" onClick={payDelivery} disabled={busy}>
              {busy ? "Starting payment…" : "Pay delivery"}
            </button>
          </div>
        </section>
      )}

      {/* Designer: ship (status=AWAITING_SHIPMENT) */}
      {actor === "designer" && p.status === PreorderStatus.AWAITING_SHIPMENT && (
        <section className="card border-violet-200 bg-violet-50/40 p-5">
          <h2 className="font-display text-lg font-semibold">Ship the piece</h2>
          <p className="mt-1 text-sm text-ink-600">
            Drop in a tracking code and hand the package to your courier. We&rsquo;ll
            send the buyer a 6-digit delivery code they hand back on receipt.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Tracking code</label>
              <input
                className="input"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                placeholder="e.g. SB7XK29A"
              />
            </div>
            <div>
              <label className="label">Courier (optional)</label>
              <input
                className="input"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="GIG, DHL, Sendbox…"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                patch({ kind: "SHIP", trackingCode, provider: provider || undefined })
              }
              disabled={busy || !trackingCode.trim()}
            >
              Mark as shipped
            </button>
          </div>
        </section>
      )}

      {/* Buyer: confirm delivery (status=SHIPPED) */}
      {actor === "buyer" && p.status === PreorderStatus.SHIPPED && (
        <section className="card p-5">
          <h2 className="font-display text-lg font-semibold">Confirm delivery</h2>
          <p className="mt-1 text-sm text-ink-500">
            Enter the 6-digit code on the package to confirm and complete the preorder.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="input max-w-[140px] text-center text-lg tracking-[0.4em]"
            />
            <button
              type="button"
              className="btn-primary"
              disabled={busy || confirmCode.length !== 6}
              onClick={() => patch({ kind: "CONFIRM", code: confirmCode })}
            >
              Confirm
            </button>
          </div>
        </section>
      )}

      {/* Designer: mark ready (status=AWAITING_READY) */}
      {actor === "designer" && p.status === PreorderStatus.AWAITING_READY && (
        <section className="card p-5">
          <h2 className="font-display text-lg font-semibold">Piece complete?</h2>
          <p className="mt-1 text-sm text-ink-500">
            Tap when you&rsquo;re done. The buyer will be notified to pay
            delivery so we can ship.
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              className="btn-primary"
              onClick={() => patch({ kind: "READY" })}
              disabled={busy}
            >
              Mark as ready
            </button>
          </div>
        </section>
      )}

      {/* Designer: delivery code reveal (status=SHIPPED) */}
      {actor === "designer" && p.status === PreorderStatus.SHIPPED && p.deliveryCode && (
        <section className="card border-emerald-200 bg-emerald-50/60 p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Delivery code
          </p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-[0.4em]">
            {p.deliveryCode}
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            Share with the buyer on arrival — they enter it to confirm.
          </p>
        </section>
      )}

      {/* Tracking summary once shipped */}
      {(p.status === PreorderStatus.SHIPPED || p.status === PreorderStatus.COMPLETED) && p.trackingCode && (
        <section className="card p-5 text-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-500">
            Tracking
          </p>
          <p className="font-mono">{p.trackingCode}</p>
          {p.logisticsProvider && (
            <p className="text-xs text-ink-500">via {p.logisticsProvider}</p>
          )}
        </section>
      )}

      {/* Cancel option — available in early states for both parties */}
      {(p.status === PreorderStatus.PENDING_PAYMENT ||
        p.status === PreorderStatus.AWAITING_READY ||
        p.status === PreorderStatus.READY ||
        p.status === PreorderStatus.AWAITING_SHIPMENT) && (
        <section className="card border-ink-200 p-5 text-center text-sm text-ink-600">
          <button
            type="button"
            className="text-xs text-burgundy-700 hover:underline"
            onClick={() => {
              const reason = window.prompt("Optional reason (sent to the other side):", "");
              if (reason === null) return;
              patch({
                kind: "TRANSITION",
                to: "CANCELLED",
                note: reason || undefined,
              });
            }}
            disabled={busy}
          >
            Cancel this preorder
          </button>
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
