"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_GROUPS } from "@/lib/enums";
import { ImageUploader } from "@/components/forms/ImageUploader";
import { PRODUCT_UNITS, type ProductUnit, unitConfig } from "@/lib/units";
import {
  SIZE_SCALES,
  type SizeScale,
  defaultScaleFor,
  isSizedCategory,
  scaleByValue,
} from "@/lib/sizes";
import {
  type AttributeGroup,
  MAX_GROUPS,
  MAX_OPTIONS_PER_GROUP,
} from "@/lib/productAttributes";

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
  attributes?: AttributeGroup[];
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
  // NGN is the canonical currency. Sellers type Naira amounts and we store
  // them as-is. Multi-currency entry is a future feature; for now both the
  // display and the storage values match 1:1.
  const initialLocalPrice = initial?.price ? roundCents(initial.price) : 0;
  const initialLocalSale =
    typeof initial?.salePrice === "number" ? roundCents(initial.salePrice) : "";

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
  // Buyer-selectable variant groups (Color, Finish, etc.). Independent of
  // `sizes` because size has its own dedicated scale-aware picker; this
  // editor is the free-form catch-all.
  const [attributes, setAttributes] = useState<AttributeGroup[]>(
    initial?.attributes ?? [],
  );
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
        // Sent and stored as NGN — the canonical currency for now.
        price: Number(price),
        salePrice: salePrice === "" ? null : Number(salePrice),
        currency: "NGN",
        category,
        status,
        stock: Number(stock),
        unit,
        // Only send sizes when the category is sized. Avoids unsized rows
        // accidentally carrying stale alpha sizes from a previous edit.
        sizes: isSizedCategory(category) ? sizes : [],
        // Filter groups whose option list ended up empty after trim/dedupe
        // — they'd just confuse the buyer. The API also drops empty groups
        // but doing it client-side keeps the payload clean.
        attributes: attributes
          .map((g) => ({
            ...g,
            name: g.name.trim(),
            options: g.options.map((o) => o.trim()).filter(Boolean),
          }))
          .filter((g) => g.name && g.options.length > 0),
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
              (🇳🇬 NGN per {unitConfig(unit).longLabel})
            </span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-500">
              ₦
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
            Stored as Naira. Multi-currency display is a future feature.
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
              ₦
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              className="input pl-8"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value === "" ? "" : Number(e.target.value))}
              aria-invalid={salePrice !== "" && Number(salePrice) >= Number(price)}
            />
          </div>
          {/* Live guard: catches the "sale price ≥ regular price" mistake
              before the server roundtrip so sellers see the problem
              inline. Same rule the API enforces in /api/products[/id]. */}
          {salePrice !== "" && Number(salePrice) >= Number(price) && (
            <p className="mt-1 text-[11px] text-red-600">
              Must be less than the regular price (₦{Number(price).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).
              Bump the regular price first if it&apos;s still showing an older value.
            </p>
          )}
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

      <AttributeEditor value={attributes} onChange={setAttributes} />

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
        <button
          type="submit"
          className="btn-primary"
          disabled={busy || (salePrice !== "" && Number(salePrice) >= Number(price))}
        >
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

// Attribute editor — buyer-selectable variant groups beyond size.
//
// Each group has a name (Color, Finish, …) and an option list. Sellers can
// add up to MAX_GROUPS groups and MAX_OPTIONS_PER_GROUP options each.
// `required` defaults to true; toggling it off lets the buyer skip the
// group at checkout (rare — most fashion-marketplace groups should be
// required so the seller knows what to pack).
//
// Storage shape mirrors the server-side schema in @/lib/productAttributes;
// the parent passes the array through to the API on save.
function AttributeEditor({
  value,
  onChange,
}: {
  value: AttributeGroup[];
  onChange: (next: AttributeGroup[]) => void;
}) {
  const [draftOptions, setDraftOptions] = useState<Record<number, string>>({});

  function updateGroup(idx: number, patch: Partial<AttributeGroup>) {
    onChange(value.map((g, i) => (i === idx ? { ...g, ...patch } : g)));
  }

  function addGroup() {
    if (value.length >= MAX_GROUPS) return;
    onChange([...value, { name: "", options: [], required: true }]);
  }

  function removeGroup(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
    setDraftOptions((d) => {
      const { [idx]: _drop, ...rest } = d;
      return rest;
    });
  }

  function addOption(idx: number) {
    const draft = (draftOptions[idx] ?? "").trim();
    if (!draft) return;
    const group = value[idx];
    if (!group) return;
    if (group.options.length >= MAX_OPTIONS_PER_GROUP) return;
    if (group.options.some((o) => o.toLowerCase() === draft.toLowerCase())) {
      setDraftOptions((d) => ({ ...d, [idx]: "" }));
      return;
    }
    updateGroup(idx, { options: [...group.options, draft] });
    setDraftOptions((d) => ({ ...d, [idx]: "" }));
  }

  function removeOption(idx: number, option: string) {
    updateGroup(idx, {
      options: (value[idx]?.options ?? []).filter((o) => o !== option),
    });
  }

  return (
    <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <label className="label mb-0">Variants</label>
          <p className="text-xs text-ink-500">
            Add picker groups buyers choose from (e.g. Color, Finish, Fabric).
            Each group becomes a required dropdown on the product page.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={addGroup}
          disabled={value.length >= MAX_GROUPS}
        >
          + Add group
        </button>
      </div>

      {value.length === 0 && (
        <p className="mt-3 text-[11px] italic text-ink-500">
          No variants yet — leave empty for products with a single version.
        </p>
      )}

      <div className="mt-3 space-y-3">
        {value.map((group, idx) => (
          <div key={idx} className="rounded-lg border border-ink-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={group.name}
                onChange={(e) => updateGroup(idx, { name: e.target.value })}
                placeholder="Group name (e.g. Color)"
                className="input flex-1 min-w-[160px] text-sm"
                maxLength={40}
              />
              <label className="flex items-center gap-1.5 text-xs text-ink-600">
                <input
                  type="checkbox"
                  checked={group.required}
                  onChange={(e) => updateGroup(idx, { required: e.target.checked })}
                  className="h-3.5 w-3.5"
                />
                Required
              </label>
              <button
                type="button"
                className="text-xs font-medium text-red-600 hover:underline"
                onClick={() => removeGroup(idx)}
              >
                Remove
              </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {group.options.map((opt) => (
                <span
                  key={opt}
                  className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800"
                >
                  {opt}
                  <button
                    type="button"
                    onClick={() => removeOption(idx, opt)}
                    className="ml-0.5 leading-none text-violet-500 hover:text-violet-800"
                    aria-label={`Remove ${opt}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="mt-2 flex gap-1.5">
              <input
                type="text"
                value={draftOptions[idx] ?? ""}
                onChange={(e) =>
                  setDraftOptions((d) => ({ ...d, [idx]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addOption(idx);
                  }
                }}
                placeholder={
                  group.options.length === 0
                    ? "Add an option, e.g. Red"
                    : "Add another option"
                }
                className="input flex-1 text-sm"
                maxLength={40}
                disabled={group.options.length >= MAX_OPTIONS_PER_GROUP}
              />
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => addOption(idx)}
                disabled={
                  !(draftOptions[idx] ?? "").trim() ||
                  group.options.length >= MAX_OPTIONS_PER_GROUP
                }
              >
                Add
              </button>
            </div>
            {group.options.length >= MAX_OPTIONS_PER_GROUP && (
              <p className="mt-1 text-[10px] italic text-ink-500">
                Cap reached — remove an option to add more.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
