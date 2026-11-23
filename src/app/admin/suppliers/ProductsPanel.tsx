"use client";

import { useState } from "react";
import { useApi } from "./api";
import { effectiveMarkup, marginPercent, sellPrice } from "@/lib/suppliers/pricing";

export type SupplierOption = { id: string; name: string; markupType: string; markupValue: number };
export type ProductRow = {
  id: string;
  supplierId: string;
  supplierName: string;
  name: string;
  image: string | null;
  category: string;
  costPrice: number;
  stock: number;
  status: "IMPORTED" | "PUBLISHED" | "HIDDEN";
  markupType: string | null;
  markupValue: number | null;
  productId: string | null;
  supplierMarkupType: string;
  supplierMarkupValue: number;
  imagesCsv: string;
};

const money = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

export function ProductsPanel({
  suppliers,
  products,
  categories,
  filters,
}: {
  suppliers: SupplierOption[];
  products: ProductRow[];
  categories: string[];
  filters: { supplier: string; status: string; q: string };
}) {
  const { busy, err, msg, setMsg, setErr, call } = useApi();
  const [mode, setMode] = useState<"none" | "add" | "csv">("none");
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [n, setN] = useState({ name: "", cost: "", stock: "10", category: "", images: "", description: "" });
  const [csv, setCsv] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [e, setE] = useState({ cost: "", stock: "", category: "", mType: "", mValue: "", images: "" });

  const imgList = (s: string) => s.split(/[\s,]+/).filter(Boolean);

  async function add() {
    const r = await call("add", "POST", "/api/admin/supplier-products", {
      supplierId,
      items: [
        {
          name: n.name,
          description: n.description || undefined,
          costPrice: Number(n.cost),
          stock: Number(n.stock) || 0,
          category: n.category || undefined,
          images: imgList(n.images),
        },
      ],
    });
    if (r) {
      setMode("none");
      setN({ name: "", cost: "", stock: "10", category: "", images: "", description: "" });
    }
  }

  // CSV columns: name, cost, stock, category, image-url(s separated by |), description
  async function importCsv() {
    const items = csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const c = line.split(",").map((x) => x.trim());
        return {
          name: c[0],
          costPrice: Number(c[1]),
          stock: Number(c[2]) || 0,
          category: c[3] || undefined,
          images: (c[4] ?? "").split("|").map((x) => x.trim()).filter(Boolean),
          description: c.slice(5).join(", ") || undefined,
        };
      })
      .filter((i) => i.name && i.costPrice > 0);
    if (items.length === 0) return setErr("No valid rows. Each line needs at least: name, cost");
    const r = await call("csv", "POST", "/api/admin/supplier-products", { supplierId, items });
    if (r) {
      setMsg(`Imported: ${r.created} new, ${r.updated} updated.`);
      setCsv("");
      setMode("none");
    }
  }

  function startEdit(p: ProductRow) {
    setEditId(p.id);
    setE({
      cost: String(p.costPrice),
      stock: String(p.stock),
      category: p.category,
      mType: p.markupType ?? "",
      mValue: p.markupValue != null ? String(p.markupValue) : "",
      images: p.imagesCsv,
    });
  }

  async function saveEdit(p: ProductRow, publish = false) {
    const override = e.mType && e.mValue !== "";
    const r = await call(`edit:${p.id}`, "PATCH", `/api/admin/supplier-products/${p.id}`, {
      costPrice: Number(e.cost),
      stock: Number(e.stock) || 0,
      category: e.category,
      images: imgList(e.images),
      markupType: override ? e.mType : null,
      markupValue: override ? Number(e.mValue) : null,
      ...(publish ? { action: "publish" } : {}),
    });
    if (r) setEditId(null);
  }

  const preview = (p: ProductRow) => {
    const cost = Number(e.cost) || 0;
    const rule = effectiveMarkup(
      { markupType: p.supplierMarkupType, markupValue: p.supplierMarkupValue },
      { markupType: e.mType || null, markupValue: e.mValue === "" ? null : Number(e.mValue) },
    );
    const price = sellPrice(cost, rule);
    return { price, profit: price - cost, margin: marginPercent(cost, price) };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form method="get" action="/admin/suppliers" className="flex flex-wrap gap-2">
          <input type="hidden" name="tab" value="products" />
          <input name="q" defaultValue={filters.q} placeholder="Search…" className="input text-sm" />
          <select name="supplier" defaultValue={filters.supplier} className="input text-sm">
            <option value="">All suppliers</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select name="status" defaultValue={filters.status} className="input text-sm">
            <option value="">All statuses</option>
            <option value="IMPORTED">Not live</option>
            <option value="PUBLISHED">Live</option>
            <option value="HIDDEN">Hidden</option>
          </select>
          <button className="btn-secondary text-sm" type="submit">Filter</button>
        </form>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm" disabled={!suppliers.length} onClick={() => setMode(mode === "csv" ? "none" : "csv")}>Import CSV</button>
          <button className="btn-primary text-sm" disabled={!suppliers.length} onClick={() => setMode(mode === "add" ? "none" : "add")}>Add product</button>
        </div>
      </div>
      {!suppliers.length && <p className="text-sm text-ink-500">Add a supplier first.</p>}
      {err && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{err}</p>}
      {msg && <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">{msg}</p>}

      {mode !== "none" && (
        <div className="card space-y-3 p-4">
          <label className="block text-sm">Supplier
            <select className="input mt-1 w-full" value={supplierId} onChange={(ev) => setSupplierId(ev.target.value)}>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          {mode === "add" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">Product name
                  <input className="input mt-1 w-full" value={n.name} onChange={(ev) => setN({ ...n, name: ev.target.value })} />
                </label>
                <label className="text-sm">Supplier cost (₦)
                  <input className="input mt-1 w-full" inputMode="decimal" value={n.cost} onChange={(ev) => setN({ ...n, cost: ev.target.value })} />
                </label>
                <label className="text-sm">Stock
                  <input className="input mt-1 w-full" inputMode="numeric" value={n.stock} onChange={(ev) => setN({ ...n, stock: ev.target.value })} />
                </label>
                <label className="text-sm">Category
                  <select className="input mt-1 w-full" value={n.category} onChange={(ev) => setN({ ...n, category: ev.target.value })}>
                    <option value="">Choose…</option>
                    {categories.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
              </div>
              <label className="block text-sm">Image URLs (comma or space separated)
                <input className="input mt-1 w-full" value={n.images} onChange={(ev) => setN({ ...n, images: ev.target.value })} />
              </label>
              <label className="block text-sm">Description
                <textarea className="input mt-1 w-full" rows={2} value={n.description} onChange={(ev) => setN({ ...n, description: ev.target.value })} />
              </label>
              <button className="btn-primary text-sm" disabled={busy === "add" || !n.name || !(Number(n.cost) > 0)} onClick={add}>
                {busy === "add" ? "Adding…" : "Add (not live yet)"}
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-ink-500">
                One product per line: <code>name, cost, stock, category, image-url (use | between several), description</code>.
                Re-importing the same name updates its cost and stock.
              </p>
              <textarea className="input w-full font-mono text-xs" rows={6} value={csv} onChange={(ev) => setCsv(ev.target.value)} />
              <button className="btn-primary text-sm" disabled={busy === "csv" || !csv.trim()} onClick={importCsv}>
                {busy === "csv" ? "Importing…" : "Import"}
              </button>
            </>
          )}
        </div>
      )}

      <ul className="card divide-y divide-ink-100">
        {products.length === 0 && <li className="p-6 text-center text-sm text-ink-500">No supplier products match.</li>}
        {products.map((p) => {
          const rule = effectiveMarkup(
            { markupType: p.supplierMarkupType, markupValue: p.supplierMarkupValue },
            { markupType: p.markupType, markupValue: p.markupValue },
          );
          const price = sellPrice(p.costPrice, rule);
          const open = editId === p.id;
          return (
            <li key={p.id} className="space-y-3 p-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-ink-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.image && <img src={p.image} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 font-medium">{p.name}</p>
                  <p className="text-xs text-ink-500">
                    {p.supplierName} · cost {money(p.costPrice)} → sells {money(price)} (profit {money(price - p.costPrice)}) · stock {p.stock}
                    {!p.category && " · needs category"}
                  </p>
                </div>
                <span className={p.status === "PUBLISHED" ? "badge bg-emerald-50 text-emerald-700" : p.status === "HIDDEN" ? "badge bg-amber-50 text-amber-700" : "badge bg-ink-50 text-ink-700"}>
                  {p.status === "PUBLISHED" ? "Live" : p.status === "HIDDEN" ? "Hidden" : "Not live"}
                </span>
                <div className="flex gap-2">
                  <button className="btn-secondary text-sm" onClick={() => (open ? setEditId(null) : startEdit(p))}>{open ? "Close" : "Edit"}</button>
                  {p.status === "PUBLISHED" ? (
                    <button className="btn-secondary text-sm" disabled={busy === `u:${p.id}`} onClick={() => call(`u:${p.id}`, "PATCH", `/api/admin/supplier-products/${p.id}`, { action: "unpublish" })}>Unpublish</button>
                  ) : (
                    <button className="btn-primary text-sm" disabled={busy === `p:${p.id}`} onClick={() => call(`p:${p.id}`, "PATCH", `/api/admin/supplier-products/${p.id}`, { action: "publish" })}>Publish</button>
                  )}
                </div>
              </div>
              {open && (
                <div className="space-y-3 rounded bg-ink-50 p-3">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <label className="text-sm">Cost (₦)
                      <input className="input mt-1 w-full" inputMode="decimal" value={e.cost} onChange={(ev) => setE({ ...e, cost: ev.target.value })} />
                    </label>
                    <label className="text-sm">Stock
                      <input className="input mt-1 w-full" inputMode="numeric" value={e.stock} onChange={(ev) => setE({ ...e, stock: ev.target.value })} />
                    </label>
                    <label className="text-sm sm:col-span-2">Category
                      <select className="input mt-1 w-full" value={e.category} onChange={(ev) => setE({ ...e, category: ev.target.value })}>
                        <option value="">Choose…</option>
                        {categories.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </label>
                    <label className="text-sm sm:col-span-2">Own markup (blank = supplier default)
                      <div className="mt-1 flex gap-2">
                        <select className="input" value={e.mType} onChange={(ev) => setE({ ...e, mType: ev.target.value })}>
                          <option value="">Default</option>
                          <option value="PERCENT">%</option>
                          <option value="FIXED">₦</option>
                        </select>
                        <input className="input w-full" inputMode="decimal" disabled={!e.mType} value={e.mValue} onChange={(ev) => setE({ ...e, mValue: ev.target.value })} />
                      </div>
                    </label>
                    <label className="text-sm sm:col-span-2">Image URLs
                      <input className="input mt-1 w-full" value={e.images} onChange={(ev) => setE({ ...e, images: ev.target.value })} />
                    </label>
                  </div>
                  {(() => {
                    const pv = preview(p);
                    return (
                      <p className="text-sm">
                        Customers pay <b>{money(pv.price)}</b> · profit <b>{money(pv.profit)}</b> per unit ({pv.margin.toFixed(1)}% margin)
                      </p>
                    );
                  })()}
                  <div className="flex gap-2">
                    <button className="btn-secondary text-sm" disabled={busy === `edit:${p.id}`} onClick={() => saveEdit(p)}>Save</button>
                    {p.status !== "PUBLISHED" && (
                      <button className="btn-primary text-sm" disabled={busy === `edit:${p.id}`} onClick={() => saveEdit(p, true)}>Save &amp; publish</button>
                    )}
                    <button
                      className="btn-secondary text-sm text-red-700"
                      onClick={() => window.confirm("Delete this product?") && call(`d:${p.id}`, "DELETE", `/api/admin/supplier-products/${p.id}`)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
