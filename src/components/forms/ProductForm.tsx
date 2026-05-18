"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_GROUPS } from "@/lib/enums";
import { useCurrency } from "@/components/CurrencyProvider";
import { ImageUploader } from "@/components/forms/ImageUploader";
import { PRODUCT_UNITS, type ProductUnit, unitConfig } from "@/lib/units";
import {
  SIZE_SCALES,
  type SizeScale,
  defaultScaleFor,
  isSizedCategory,
  scaleByValue,
} from "@/lib/sizes";

type ProductStatusValue = "DRAFT" | "ACTIVE" | "SOLD_OUT" | "ARCHIVED";

type ProductFormInitial = {
  id?: string;
  name?: string;
  description?: string;
  price?: number;
  salePrice?: number | null;
  category?: string;
  status?: string;
  stock?: number;
  unit?: string;
  sizes?: string[];
  images?: string[];
};

type Props = {
  initial?: ProductFormInitial;
  mode: "create" | "edit";
  // Where to send the user after a successful save.
  redirectBase?: string;
};

const ALL_CATEGORIES = Object.entries(CATEGORY_GROUPS) as ReadonlyArray<
  readonly [string, readonly string[]]
>;

export function ProductForm({ initial, mode, redirectBase = "/seller/products" }: Props) {
  const router = useRouter();
  // Active display currency — geolocated or user-selected. The form mirrors
  // it: sellers always type prices in their own currency; the server
  // converts to the canonical USD before storage.
  const ctx = useCurrency();
  // Convert the stored USD price into the active currency for the input
  // field. We do this once on first render via useMemo so the value is
  // stable across re-renders triggered by other fields. The original USD
  // value lives only in `initial.price` — we never write it back into state.
  const initialLocalPrice = useMemo(
    () => (initial?.price ? roundCents(initial.price * ctx.rate) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const initialLocalSale = useMemo(
    () =>
      typeof initial?.salePrice === "number"
        ? roundCents(initial.salePrice * ctx.rate)
        : "",
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState<number>(initialLocalPrice);
  const [salePrice, setSalePrice] = useState<number | "">(initialLocalSale);
  const [category, setCategory] = useState(initial?.category ?? ALL_CATEGORIES[0][1][0]);
  const [status, setStatus] = useState<ProductStatusValue>(
    (initial?.status as ProductStatusValue) ?? "ACTIVE",
  );
  const [stock, setStock] = useState<number>(initial?.stock ?? 99);
  const [unit, setUnit] = useState<ProductUnit>(
    (initial?.unit as ProductUnit) ?? "piece",
  );
  // Size selector state. Only used for "sized" categories (clothing, shoes,
  // bags). The scale defaults from the category mapping; the seller can
  // switch if their goods follow a different scale (e.g. EU vs UK numeric).
  const [sizeScale, setSizeScale] = useState<SizeScale>(
    defaultScaleFor(initial?.category ?? "") ?? "alpha",
  );
  const [sizes, setSizes] = useState<string[]>(initial?.sizes ?? []);
  const [images, setImages] = useState<string[]>(initial?.images ?? []);

  // When the seller picks a different category, switch to the recommended
  // scale and clear any sizes that no longer exist on the new scale.
  function changeCategory(next: string) {
    setCategory(next);
    const recommended = defaultScaleFor(next);
    if (recommended) {
      setSizeScale(recommended);
      const allowed = new Set(scaleByValue(recommended).sizes);
      setSizes((prev) => prev.filter((s) => allowed.has(s)));
    } else {
      // Unsized category — wipe the sizes so we don't ship orphans.
      setSizes([]);
    }
  }

  function toggleSize(size: string) {
    setSizes((cur) => (cur.includes(size) ? cur.filter((s) => s !== size) : [...cur, size]));
  }
  const [aiNotes, setAiNotes] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const payload = {
        name,
        description,
        // Sent in the seller's active currency. The API converts to USD.
        price: Number(price),
        salePrice: salePrice === "" ? null : Number(salePrice),
        currency: ctx.code,
        category,
        status,
        stock: Number(stock),
        unit,
        // Only send sizes when the category is sized. Avoids unsized rows
        // accidentally carrying stale alpha sizes from a previous edit.
        sizes: isSizedCategory(category) ? sizes : [],
        images,
      };

      const res = await fetch(
        mode === "create" ? "/api/products" : `/api/products/${initial?.id}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 422 && data.validation) {
          setErr(`Rejected: ${data.validation.reason}`);
        } else {
          setErr(data.error ?? "Save failed");
        }
        return;
      }
      router.push(`${redirectBase}/${data.product.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function generateDescription() {
    if (!name.trim()) {
      setErr("Add a product name first so the AI has something to work from.");
      return;
    }
    setErr(null);
    setAiBusy(true);
    try {
      const res = await fetch("/api/ai/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, notes: aiNotes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Couldn't generate description");
        return;
      }
      setDescription(data.description);
    } finally {
      setAiBusy(false);
    }
  }

  async function preValidate() {
    if (!name.trim() || !description.trim()) {
      setErr("Add a name and description first.");
      return;
    }
    setErr(null);
    setAiBusy(true);
    try {
      const res = await fetch("/api/ai/validate-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, category }),
      });
      const data = await res.json();
      if (!data.allowed) {
        setErr(`This listing would be rejected: ${data.reason}`);
      } else {
        setErr(null);
        alert(`Looks good — ${data.reason}`);
      }
    } finally {
      setAiBusy(false);
    }
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!confirm("Delete this product? This cannot be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/products/${initial.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push(redirectBase);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label">Name</label>
        <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-amber-700">✨ AI helpers</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={preValidate}
              className="btn-secondary text-xs"
              disabled={aiBusy}
            >
              {aiBusy ? "Checking…" : "Pre-validate"}
            </button>
            <button
              type="button"
              onClick={generateDescription}
              className="btn-primary text-xs"
              disabled={aiBusy || !name.trim()}
            >
              {aiBusy ? "…" : "Generate description"}
            </button>
          </div>
        </div>
        <input
          className="input mt-2 text-xs"
          placeholder="Optional notes for the AI (fabric, fit, occasion)…"
          value={aiNotes}
          onChange={(e) => setAiNotes(e.target.value)}
        />
        <p className="mt-2 text-[11px] text-gray-500">
          Listings outside the fashion allowlist will be auto-rejected on save.
        </p>
      </div>

      <div>
        <label className="label">Description</label>
        <textarea className="input min-h-[120px]" required value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <label className="label">
            Price{" "}
            <span className="text-[11px] font-normal text-ink-500">
              ({ctx.flag} {ctx.code} per {unitConfig(unit).longLabel})
            </span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-500">
              {ctx.symbol}
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              className="input pl-8"
              required
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </div>
          <p className="mt-1 text-[11px] text-ink-500">
            Stored as USD; auto-converts to other currencies for buyers.
          </p>
        </div>
        <div>
          <label className="label">Pricing unit</label>
          <select
            className="input"
            value={unit}
            onChange={(e) => setUnit(e.target.value as ProductUnit)}
          >
            {PRODUCT_UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-ink-500">
            Pick &ldquo;yard&rdquo; / &ldquo;meter&rdquo; for fabrics so buyers can pick the
            length they want.
          </p>
        </div>
        <div>
          <label className="label">
            Sale price <span className="text-xs text-gray-400">(optional)</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-500">
              {ctx.symbol}
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              className="input pl-8"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>
        </div>
        <div>
          <label className="label">Stock</label>
          <input type="number" min={0} step={1} className="input" value={stock} onChange={(e) => setStock(Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as ProductStatusValue)}>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="SOLD_OUT">Sold out</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label">Category</label>
        <select className="input" value={category} onChange={(e) => changeCategory(e.target.value)}>
          {ALL_CATEGORIES.map(([group, items]) => (
            <optgroup key={group} label={group}>
              {items.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Size selector — only renders for clothing / shoes / bags etc.
          Materials and unsized items skip this entirely. The seller can
          override the auto-picked scale (e.g. EU numeric instead of alpha)
          via the dropdown. */}
      {isSizedCategory(category) && (
        <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <label className="label mb-0">Available sizes</label>
              <p className="text-xs text-ink-500">
                Pick every size you stock. Buyers select one at checkout.
              </p>
            </div>
            <select
              className="input max-w-[180px] text-sm"
              value={sizeScale}
              onChange={(e) => {
                const next = e.target.value as SizeScale;
                setSizeScale(next);
                const allowed = new Set(scaleByValue(next).sizes);
                setSizes((prev) => prev.filter((s) => allowed.has(s)));
              }}
            >
              {SIZE_SCALES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {scaleByValue(sizeScale).sizes.map((s) => {
              const on = sizes.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSize(s)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    on
                      ? "border-violet-500 bg-violet-600 text-white"
                      : "border-ink-200 bg-white text-ink-700 hover:border-violet-300"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
          {sizes.length === 0 && (
            <p className="mt-2 text-[11px] italic text-ink-500">
              No sizes selected — buyers won&apos;t be able to add this to cart.
            </p>
          )}
        </div>
      )}

      <div>
        <label className="label">Images</label>
        <ImageUploader
          value={images}
          onChange={setImages}
          multi
          max={8}
          label="The first image becomes the cover. Drag to reorder is on the roadmap — for now, remove and re-add to change cover."
        />
      </div>

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="flex justify-between">
        {mode === "edit" ? (
          <button type="button" className="btn-danger" onClick={onDelete} disabled={busy}>Delete</button>
        ) : <span />}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : mode === "create" ? "Create listing" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

// Round to 2 decimals so the displayed local-currency price doesn't show
// FX-rate noise like 749.999999 right after a USD → local conversion.
function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}
