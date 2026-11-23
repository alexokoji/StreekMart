"use client";

import { useState } from "react";
import { useApi } from "./api";
import { ApiConfigSchema, type ApiConfig } from "@/lib/suppliers/apiConfig";

export type SupplierRow = {
  id: string;
  name: string;
  integration: "MANUAL" | "API";
  apiBaseUrl: string | null;
  apiConfig: ApiConfig;
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

const DEFAULT_CFG: ApiConfig = ApiConfigSchema.parse({});

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

type TestResult = {
  ok: boolean;
  error?: string;
  ms?: number;
  count?: number;
  sample?: { externalId: string; name: string; costPrice: number; stock: number; images: string[]; category: string }[];
  skipped?: string[];
  warnings?: string[];
};

export function SuppliersPanel({ suppliers }: { suppliers: SupplierRow[] }) {
  const { busy, err, msg, setMsg, call } = useApi();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [f, setF] = useState(EMPTY);
  const [cfg, setCfg] = useState<ApiConfig | null>(null);
  const [advanced, setAdvanced] = useState("");
  const [advErr, setAdvErr] = useState<string | null>(null);
  const [test, setTest] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  function open(s?: SupplierRow) {
    setEditing(s ? s.id : "new");
    setTest(null);
    const c = s?.apiConfig ?? (null as ApiConfig | null);
    setCfg(c);
    setAdvanced(c ? JSON.stringify({ catalog: { pagination: c.catalog.pagination }, order: c.order, tracking: c.tracking, headers: c.headers }, null, 2) : "");
    setAdvErr(null);
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

  // Merge the structured fields with the advanced JSON into one config.
  function buildConfig(): Record<string, unknown> | null {
    let adv: Record<string, any> = {};
    if (advanced.trim()) {
      try {
        adv = JSON.parse(advanced);
        setAdvErr(null);
      } catch {
        setAdvErr("Advanced JSON isn't valid JSON.");
        return null;
      }
    }
    const base = cfg ?? ({ auth: { type: "BEARER" }, catalog: {} } as any);
    return {
      auth: base.auth,
      headers: adv.headers ?? base.headers ?? {},
      catalog: { ...base.catalog, ...(adv.catalog ?? {}), fields: base.catalog?.fields },
      order: adv.order ?? base.order,
      tracking: adv.tracking ?? base.tracking,
    };
  }

  async function runTest() {
    const apiConfig = buildConfig();
    if (!apiConfig) return;
    setTesting(true);
    setTest(null);
    try {
      const res = await fetch("/api/admin/suppliers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: editing !== "new" ? editing : undefined,
          apiBaseUrl: f.apiBaseUrl,
          apiKey: f.apiKey || undefined,
          apiConfig,
        }),
      });
      setTest((await res.json()) as TestResult);
    } catch {
      setTest({ ok: false, error: "Network error — try again." });
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    const apiConfig = f.integration === "API" ? buildConfig() : undefined;
    if (f.integration === "API" && !apiConfig) return;
    const body = {
      ...(apiConfig ? { apiConfig } : {}),
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

  // Defaults mirror ApiConfigSchema so a fresh API supplier shows what applies.
  function ensureCfg(): ApiConfig {
    if (cfg) return cfg;
    const d = DEFAULT_CFG;
    setCfg(d);
    setAdvanced(JSON.stringify({ catalog: { pagination: d.catalog.pagination }, order: d.order, tracking: d.tracking, headers: d.headers }, null, 2));
    return d;
  }
  const setCat = (patch: Record<string, unknown>) => {
    const c = ensureCfg();
    setCfg({ ...c, catalog: { ...c.catalog, ...patch } });
  };
  const setField = (k: string, v: string) => {
    const c = ensureCfg();
    setCfg({ ...c, catalog: { ...c.catalog, fields: { ...c.catalog.fields, [k]: v } } });
  };

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
            {f.integration === "API" && (
              <div className="space-y-3 rounded border border-ink-100 p-3 sm:col-span-2">
                <p className="text-sm font-medium">API mapping</p>
                <p className="text-xs text-ink-500">
                  Tell us where things live in the supplier&rsquo;s responses. Defaults suit a simple
                  <code> /products </code> + <code> /orders </code> API. Use <b>Test connection</b> to preview before saving.
                </p>
                {(() => {
                  const c = cfg ?? DEFAULT_CFG;
                  return (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="text-sm">Auth style
                        <select className="input mt-1 w-full" value={c.auth.type} onChange={(e) => { const x = ensureCfg(); setCfg({ ...x, auth: { ...x.auth, type: e.target.value as any } }); }}>
                          <option value="BEARER">Bearer token</option>
                          <option value="HEADER">Custom header</option>
                          <option value="QUERY">Query parameter</option>
                          <option value="BASIC">Basic (user:pass)</option>
                          <option value="NONE">None</option>
                        </select>
                      </label>
                      <label className="text-sm">Header / param name
                        <input className="input mt-1 w-full" placeholder="X-API-Key" value={c.auth.name ?? ""} onChange={(e) => { const x = ensureCfg(); setCfg({ ...x, auth: { ...x.auth, name: e.target.value } }); }} />
                      </label>
                      <label className="text-sm">Catalog path
                        <input className="input mt-1 w-full" value={c.catalog.path} onChange={(e) => setCat({ path: e.target.value })} />
                      </label>
                      <label className="text-sm">Items array path
                        <input className="input mt-1 w-full" placeholder="products (blank = root)" value={c.catalog.itemsPath} onChange={(e) => setCat({ itemsPath: e.target.value })} />
                      </label>
                      <label className="text-sm">Price ÷ (e.g. 100 for kobo)
                        <input className="input mt-1 w-full" inputMode="decimal" value={c.catalog.priceDivisor} onChange={(e) => setCat({ priceDivisor: Number(e.target.value) || 1 })} />
                      </label>
                      <label className="text-sm">Price × (e.g. USD→₦ rate)
                        <input className="input mt-1 w-full" inputMode="decimal" value={c.catalog.priceMultiplier} onChange={(e) => setCat({ priceMultiplier: Number(e.target.value) || 1 })} />
                      </label>
                      {(["externalId", "name", "cost", "stock", "images", "category", "description"] as const).map((k) => (
                        <label key={k} className="text-sm">Field: {k === "externalId" ? "id / SKU" : k === "cost" ? "price" : k}
                          <input className="input mt-1 w-full" value={c.catalog.fields[k]} onChange={(e) => setField(k, e.target.value)} />
                        </label>
                      ))}
                    </div>
                  );
                })()}
                <label className="block text-sm">Advanced — pagination, order request, tracking (JSON)
                  <textarea className="input mt-1 w-full font-mono text-xs" rows={10} spellCheck={false}
                    value={advanced || JSON.stringify({ catalog: { pagination: DEFAULT_CFG.catalog.pagination }, order: DEFAULT_CFG.order, tracking: DEFAULT_CFG.tracking, headers: {} }, null, 2)}
                    onChange={(e) => setAdvanced(e.target.value)} />
                </label>
                {advErr && <p className="text-sm text-red-700">{advErr}</p>}
                <div className="flex items-center gap-2">
                  <button type="button" className="btn-secondary text-sm" disabled={testing || !f.apiBaseUrl} onClick={runTest}>
                    {testing ? "Testing…" : "Test connection"}
                  </button>
                  <span className="text-xs text-ink-500">Fetches a few items; saves nothing.</span>
                </div>
                {test && (
                  <div className={`rounded p-3 text-sm ${test.ok ? "bg-emerald-50" : "bg-red-50 text-red-700"}`}>
                    {test.ok ? (
                      <>
                        <p className="font-medium">Connected in {test.ms}ms — {test.count} usable items found.</p>
                        {test.warnings?.map((w) => <p key={w} className="text-amber-700">⚠ {w}</p>)}
                        <ul className="mt-2 space-y-1 text-xs">
                          {test.sample?.map((i) => (
                            <li key={i.externalId}>
                              <b>{i.name}</b> — cost ₦{i.costPrice.toLocaleString()} · stock {i.stock} · {i.images.length} image(s){i.category ? ` · ${i.category}` : ""}
                            </li>
                          ))}
                        </ul>
                        {!!test.skipped?.length && <p className="mt-1 text-xs text-ink-600">Skipped rows: {test.skipped.join("; ")}</p>}
                      </>
                    ) : (
                      <p>{test.error}</p>
                    )}
                  </div>
                )}
              </div>
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
                <a className="btn-secondary text-sm" href={`/admin/suppliers?tab=products&supplier=${s.id}`}>Products</a>
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
