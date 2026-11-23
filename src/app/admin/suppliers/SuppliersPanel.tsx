"use client";

import { useState } from "react";
import { useApi } from "./api";

export type SupplierRow = {
  id: string;
  name: string;
  integration: "MANUAL" | "API";
  apiBaseUrl: string | null;
  hasApiKey: boolean;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  markupType: "PERCENT" | "FIXED";
  markupValue: number;
  active: boolean;
  lastSyncAt: string | null;
  lastSyncNote: string | null;
  productCount: number;
  liveCount: number;
  orderCount: number;
  profit: number;
};

const money = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

const EMPTY = {
  name: "",
  integration: "MANUAL" as "MANUAL" | "API",
  apiBaseUrl: "",
  apiKey: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  notes: "",
  markupType: "PERCENT" as "PERCENT" | "FIXED",
  markupValue: "25",
};

export function SuppliersPanel({ suppliers }: { suppliers: SupplierRow[] }) {
  const { busy, err, msg, setMsg, call } = useApi();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [f, setF] = useState(EMPTY);

  function open(s?: SupplierRow) {
    setEditing(s ? s.id : "new");
    setF(
      s
        ? {
            name: s.name,
            integration: s.integration,
            apiBaseUrl: s.apiBaseUrl ?? "",
            apiKey: "",
            contactName: s.contactName ?? "",
            contactEmail: s.contactEmail ?? "",
            contactPhone: s.contactPhone ?? "",
            notes: s.notes ?? "",
            markupType: s.markupType,
            markupValue: String(s.markupValue),
          }
        : EMPTY,
    );
  }

  async function save() {
    const body = {
      name: f.name,
      integration: f.integration,
      apiBaseUrl: f.integration === "API" ? f.apiBaseUrl || null : null,
      ...(f.apiKey ? { apiKey: f.apiKey } : {}),
      contactName: f.contactName || null,
      contactEmail: f.contactEmail || null,
      contactPhone: f.contactPhone || null,
      notes: f.notes || null,
      markupType: f.markupType,
      markupValue: Number(f.markupValue) || 0,
    };
    const r =
      editing === "new"
        ? await call("save", "POST", "/api/admin/suppliers", body)
        : await call("save", "PATCH", `/api/admin/suppliers/${editing}`, body);
    if (r) setEditing(null);
  }

  async function sync(id: string) {
    const r = await call(`sync:${id}`, "POST", `/api/admin/suppliers/${id}/sync`);
    if (r) setMsg(`Synced: ${r.created} new, ${r.updated} updated.`);
  }

  async function remove(s: SupplierRow) {
    if (!window.confirm(`Delete ${s.name}? Its listings will be archived.`)) return;
    await call(`del:${s.id}`, "DELETE", `/api/admin/suppliers/${s.id}?confirm=${s.id}`);
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-600">
          Shoppers only ever see StreekMart. Suppliers, costs and profit are visible here only.
        </p>
        <button className="btn-primary text-sm" onClick={() => open()}>
          Add supplier
        </button>
      </div>
      {err && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{err}</p>}
      {msg && <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">{msg}</p>}

      {editing && (
        <div className="card space-y-3 p-4">
          <h2 className="font-semibold">{editing === "new" ? "New supplier" : "Edit supplier"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Name
              <input className="input mt-1 w-full" value={f.name} onChange={set("name")} />
            </label>
            <label className="text-sm">How do we work with them?
              <select className="input mt-1 w-full" value={f.integration} onChange={set("integration")}>
                <option value="MANUAL">Manual — I add products and place their orders myself</option>
                <option value="API">API — sync catalog and place orders automatically</option>
              </select>
            </label>
            {f.integration === "API" && (
              <>
                <label className="text-sm">API base URL
                  <input className="input mt-1 w-full" placeholder="https://api.supplier.com/v1" value={f.apiBaseUrl} onChange={set("apiBaseUrl")} />
                </label>
                <label className="text-sm">API key {editing !== "new" && "(leave blank to keep current)"}
                  <input className="input mt-1 w-full" type="password" autoComplete="off" value={f.apiKey} onChange={set("apiKey")} />
                </label>
              </>
            )}
            <label className="text-sm">Our markup
              <div className="mt-1 flex gap-2">
                <select className="input" value={f.markupType} onChange={set("markupType")}>
                  <option value="PERCENT">% on cost</option>
                  <option value="FIXED">₦ added</option>
                </select>
                <input className="input w-full" inputMode="decimal" value={f.markupValue} onChange={set("markupValue")} />
              </div>
            </label>
            <label className="text-sm">Contact name
              <input className="input mt-1 w-full" value={f.contactName} onChange={set("contactName")} />
            </label>
            <label className="text-sm">Contact email
              <input className="input mt-1 w-full" value={f.contactEmail} onChange={set("contactEmail")} />
            </label>
            <label className="text-sm">Contact phone
              <input className="input mt-1 w-full" value={f.contactPhone} onChange={set("contactPhone")} />
            </label>
          </div>
          <label className="block text-sm">Notes (private)
            <textarea className="input mt-1 w-full" rows={2} value={f.notes} onChange={set("notes")} />
          </label>
          {editing !== "new" && (
            <p className="text-xs text-ink-500">
              Changing the markup re-prices every live product from this supplier (unless it has its own override).
            </p>
          )}
          <div className="flex gap-2">
            <button className="btn-primary text-sm" disabled={busy === "save" || !f.name.trim()} onClick={save}>
              {busy === "save" ? "Saving…" : "Save"}
            </button>
            <button className="btn-secondary text-sm" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      {suppliers.length === 0 && !editing && (
        <p className="card p-6 text-center text-sm text-ink-500">No suppliers yet. Add your first one to start sourcing products.</p>
      )}

      <ul className="space-y-3">
        {suppliers.map((s) => (
          <li key={s.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  {s.name}{" "}
                  <span className={s.active ? "badge bg-emerald-50 text-emerald-700" : "badge bg-amber-50 text-amber-700"}>
                    {s.active ? "Active" : "Paused"}
                  </span>{" "}
                  <span className="badge bg-ink-50 text-ink-700">{s.integration === "API" ? "API" : "Manual"}</span>
                </p>
                <p className="text-xs text-ink-500">
                  Markup {s.markupType === "PERCENT" ? `${s.markupValue}%` : money(s.markupValue)} ·{" "}
                  {s.productCount} products ({s.liveCount} live) · {s.orderCount} orders · profit {money(s.profit)}
                </p>
                {(s.contactName || s.contactEmail || s.contactPhone) && (
                  <p className="text-xs text-ink-500">
                    {[s.contactName, s.contactEmail, s.contactPhone].filter(Boolean).join(" · ")}
                  </p>
                )}
                {s.lastSyncNote && <p className="text-xs text-ink-500">Last sync: {s.lastSyncNote}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {s.integration === "API" && (
                  <button className="btn-secondary text-sm" disabled={busy === `sync:${s.id}`} onClick={() => sync(s.id)}>
                    {busy === `sync:${s.id}` ? "Syncing…" : "Sync catalog"}
                  </button>
                )}
                <button className="btn-secondary text-sm" onClick={() => open(s)}>Edit</button>
                <button
                  className="btn-secondary text-sm"
                  onClick={() => call(`act:${s.id}`, "PATCH", `/api/admin/suppliers/${s.id}`, { active: !s.active })}
                >
                  {s.active ? "Pause" : "Resume"}
                </button>
                {s.orderCount === 0 && (
                  <button className="btn-secondary text-sm text-red-700" onClick={() => remove(s)}>Delete</button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
