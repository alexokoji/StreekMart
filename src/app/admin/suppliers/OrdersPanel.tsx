"use client";

import { useState } from "react";
import { useApi } from "./api";

export type SupplierOrderRow = {
  id: string;
  orderId: string;
  supplierName: string;
  integration: string;
  productName: string;
  quantity: number;
  totalCost: number;
  revenue: number;
  status: string;
  externalOrderId: string | null;
  trackingCode: string | null;
  error: string | null;
  recipient: string;
  address: string;
  createdAt: string;
};

const money = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

const STATUSES = ["TO_PLACE", "PLACED", "SHIPPED", "DELIVERED", "FAILED", "CANCELLED"];
const LABEL: Record<string, string> = {
  TO_PLACE: "Needs placing",
  PLACED: "Placed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  FAILED: "Auto-place failed",
  CANCELLED: "Cancelled",
};

export function OrdersPanel({ orders, status }: { orders: SupplierOrderRow[]; status: string }) {
  const { busy, err, call } = useApi();
  const [open, setOpen] = useState<string | null>(null);
  const [f, setF] = useState({ status: "", ext: "", tracking: "" });

  return (
    <div className="space-y-4">
      <form method="get" action="/admin/suppliers" className="flex gap-2">
        <input type="hidden" name="tab" value="orders" />
        <select name="status" defaultValue={status} className="input text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
        </select>
        <button className="btn-secondary text-sm" type="submit">Filter</button>
      </form>
      {err && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{err}</p>}

      <ul className="card divide-y divide-ink-100">
        {orders.length === 0 && <li className="p-6 text-center text-sm text-ink-500">No supplier orders yet. They appear here when a customer buys a sourced product.</li>}
        {orders.map((o) => (
          <li key={o.id} className="space-y-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{o.productName} × {o.quantity}</p>
                <p className="text-xs text-ink-500">
                  {o.supplierName} · order {o.orderId.slice(-6)} · pay supplier {money(o.totalCost)} · customer paid {money(o.revenue)} · profit {money(o.revenue - o.totalCost)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={o.status === "FAILED" ? "badge bg-red-50 text-red-700" : o.status === "TO_PLACE" ? "badge bg-amber-50 text-amber-700" : "badge bg-ink-50 text-ink-700"}>
                  {LABEL[o.status] ?? o.status}
                </span>
                <button
                  className="btn-secondary text-sm"
                  onClick={() => {
                    setOpen(open === o.id ? null : o.id);
                    setF({ status: o.status, ext: o.externalOrderId ?? "", tracking: o.trackingCode ?? "" });
                  }}
                >
                  {open === o.id ? "Close" : "Update"}
                </button>
              </div>
            </div>
            {o.error && <p className="text-xs text-red-700">Error: {o.error}</p>}
            {open === o.id && (
              <div className="space-y-3 rounded bg-ink-50 p-3">
                <p className="text-sm">
                  <b>Ship to:</b> {o.recipient} — {o.address || "no address on file"}
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-sm">Status
                    <select className="input mt-1 w-full" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                      {STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
                    </select>
                  </label>
                  <label className="text-sm">Supplier order ref
                    <input className="input mt-1 w-full" value={f.ext} onChange={(e) => setF({ ...f, ext: e.target.value })} />
                  </label>
                  <label className="text-sm">Tracking code
                    <input className="input mt-1 w-full" value={f.tracking} onChange={(e) => setF({ ...f, tracking: e.target.value })} />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-primary text-sm"
                    disabled={busy === `s:${o.id}`}
                    onClick={async () => {
                      const r = await call(`s:${o.id}`, "PATCH", `/api/admin/supplier-orders/${o.id}`, {
                        status: f.status,
                        externalOrderId: f.ext || null,
                        trackingCode: f.tracking || null,
                      });
                      if (r) setOpen(null);
                    }}
                  >
                    Save
                  </button>
                  {o.integration === "API" && (o.status === "FAILED" || o.status === "TO_PLACE") && (
                    <button className="btn-secondary text-sm" disabled={busy === `r:${o.id}`} onClick={() => call(`r:${o.id}`, "PATCH", `/api/admin/supplier-orders/${o.id}`, { retry: true })}>
                      {busy === `r:${o.id}` ? "Placing…" : "Retry auto-place"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
