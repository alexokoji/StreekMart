"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Price } from "@/components/Price";

export default function SellerShipmentPanel({
  orderId,
  shippingRates,
  shipment,
}: {
  orderId: string;
  shippingRates?: any[] | null;
  shipment?: any | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selected = (shippingRates || []).find((r) => r.selected) || (shippingRates || [])[0] || null;

  async function createShipment() {
    setErr(null);
    setBusy(true);
    try {
      if (!selected) {
        setErr("No shipping choice available to create shipment.");
        return;
      }
      const res = await fetch(`/api/orders/${orderId}/shipping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Failed to create shipment");
        return;
      }
      router.refresh();
    } catch (err) {
      setErr(err instanceof Error ? err.message : "Failed to create shipment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500">Shipping</h2>
      {shipment ? (
        <div className="space-y-2">
          <p className="text-sm">Shipment created</p>
          {shipment.trackingCode && <p className="font-mono">Tracking: {shipment.trackingCode}</p>}
          {shipment.labelUrl && (
            <a href={shipment.labelUrl} target="_blank" rel="noreferrer" className="btn-secondary block">
              Download label
            </a>
          )}
          {shipment.receiptUrl && (
            <a href={shipment.receiptUrl} target="_blank" rel="noreferrer" className="btn-secondary block">
              Download receipt
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {selected ? (
            <div>
              <p className="text-sm">Buyer selected:</p>
              <p className="font-medium">{selected.courierName || selected.courierId} — <Price amount={((selected.amountCents ?? selected.price ?? 0) / 100)} /></p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No shipping choice provided by buyer.</p>
          )}

          <div className="flex gap-2">
            <button className="btn-primary" onClick={createShipment} disabled={busy || !selected}>
              {busy ? "Creating…" : "Create shipment"}
            </button>
            <a href={`/seller/orders/${orderId}/print`} className="btn-secondary">Print order</a>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
      )}
    </div>
  );
}
