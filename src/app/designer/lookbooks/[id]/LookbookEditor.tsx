"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type EditorItem = {
  key: string;
  kind: "post" | "product";
  id: string;
  title: string;
  image: string | null;
};

// Stateful editor for a single Collection. Owns:
//   - metadata (title, description, status)
//   - the ordered item list
// On save it PATCHes /api/collections/[id] with the whole shape.
//
// Reordering is move-up/move-down arrows rather than drag-and-drop — drag
// reorder needs a touch-aware lib and the cost wasn't worth it in V1. Easy
// upgrade later.
export function LookbookEditor({
  collectionId,
  initialTitle,
  initialDescription,
  initialStatus,
  initialItems,
  availableItems,
  publicHref,
}: {
  collectionId: string;
  initialTitle: string;
  initialDescription: string;
  initialStatus: "DRAFT" | "PUBLIC";
  initialItems: EditorItem[];
  availableItems: EditorItem[];
  publicHref: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [status, setStatus] = useState<"DRAFT" | "PUBLIC">(initialStatus);
  const [items, setItems] = useState<EditorItem[]>(initialItems);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const usedKeys = new Set(items.map((i) => i.key));
  const remaining = availableItems.filter((a) => !usedKeys.has(a.key));

  function move(idx: number, delta: number) {
    const next = [...items];
    const target = idx + delta;
    if (target < 0 || target >= next.length) return;
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    setItems(next);
  }

  function add(item: EditorItem) {
    setItems((prev) => [...prev, item]);
  }

  function remove(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/collections/${collectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          status,
          items: items.map((i) =>
            i.kind === "post" ? { postId: i.id } : { productId: i.id },
          ),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Save failed.");
        return;
      }
      setSaved(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function destroy() {
    if (!window.confirm("Delete this look-book? The items themselves stay; only the collection is removed.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/collections/${collectionId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/designer/lookbooks");
      } else {
        setErr("Delete failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Metadata */}
      <div className="card space-y-4 p-6">
        <div>
          <label className="label">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            minLength={2}
            maxLength={80}
          />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input min-h-[80px]"
            maxLength={500}
          />
        </div>
        <div>
          <label className="label">Visibility</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStatus("DRAFT")}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                status === "DRAFT"
                  ? "border-amber-500 bg-amber-100 text-amber-800"
                  : "border-ink-200 bg-white text-ink-600"
              }`}
            >
              Draft
            </button>
            <button
              type="button"
              onClick={() => setStatus("PUBLIC")}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                status === "PUBLIC"
                  ? "border-violet-500 bg-violet-100 text-violet-800"
                  : "border-ink-200 bg-white text-ink-600"
              }`}
            >
              Public
            </button>
          </div>
          <p className="mt-1 text-[11px] text-ink-500">
            Public look-books appear at{" "}
            <Link href={publicHref} className="text-violet-700 hover:underline">
              {publicHref}
            </Link>
          </p>
        </div>
      </div>

      {/* In-collection items */}
      <div className="card p-6">
        <h2 className="font-display text-lg font-semibold">In this look-book</h2>
        {items.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">
            Empty. Add posts or products from the picker below.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {items.map((it, idx) => (
              <li
                key={it.key}
                className="flex items-center gap-3 rounded-lg border border-ink-100 p-2"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-ink-100">
                  {it.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="break-words text-sm font-medium">{it.title}</p>
                  <p className="text-[10px] uppercase tracking-wider text-ink-500">{it.kind}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    className="rounded p-1 text-ink-500 hover:bg-ink-50 disabled:opacity-30"
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={idx === items.length - 1}
                    className="rounded p-1 text-ink-500 hover:bg-ink-50 disabled:opacity-30"
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    className="rounded p-1 text-red-500 hover:bg-red-50"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Picker */}
      <div className="card p-6">
        <h2 className="font-display text-lg font-semibold">Add items</h2>
        {remaining.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">
            Nothing else to add — every post and product you own is already in this look-book.
          </p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {remaining.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => add(item)}
                className="flex items-center gap-2 rounded-lg border border-ink-100 p-2 text-left hover:border-violet-300 hover:bg-violet-50/40"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-ink-100">
                  {item.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-1 text-xs font-medium">{item.title}</p>
                  <p className="text-[10px] uppercase tracking-wider text-ink-500">{item.kind}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}
      {saved && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Saved.
        </div>
      )}

      <div className="flex justify-between">
        <button type="button" className="btn-danger" onClick={destroy} disabled={busy}>
          Delete look-book
        </button>
        <button type="button" className="btn-primary" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
