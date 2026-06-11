"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Row = {
  id: string;
  name: string;
  groupName: string;
  kind: "MATERIAL" | "PRODUCT";
  displayOrder: number;
  enabled: boolean;
  usage: number;
};

export function CategoriesEditor({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Add form
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState("Clothing");
  const [newKind, setNewKind] = useState<"MATERIAL" | "PRODUCT">("PRODUCT");

  // Snapshot known groups so the dropdown can offer existing ones AND let
  // admins type a new one (the input is a datalist below).
  const groups = useMemo(() => {
    const set = new Set<string>(rows.map((r) => r.groupName));
    ["Materials", "Clothing", "Accessories", "Beauty"].forEach((g) => set.add(g));
    return Array.from(set).sort();
  }, [rows]);

  async function call(opts: {
    op: string;
    method: "POST" | "PATCH" | "DELETE";
    url: string;
    body?: unknown;
  }) {
    setBusy(opts.op);
    setErr(null);
    try {
      const res = await fetch(opts.url, {
        method: opts.method,
        headers: { "Content-Type": "application/json" },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Something went wrong.");
        return null;
      }
      router.refresh();
      return data as Record<string, unknown>;
    } finally {
      setBusy(null);
    }
  }

  async function add() {
    if (!newName.trim()) return;
    const data = await call({
      op: "add",
      method: "POST",
      url: "/api/admin/categories",
      body: { name: newName.trim(), groupName: newGroup.trim(), kind: newKind },
    });
    if (data && "category" in data) {
      const c = data.category as Row;
      setRows((r) => [...r, { ...c, usage: 0 }]);
      setNewName("");
    }
  }

  async function patch(id: string, body: Partial<Row>) {
    await call({ op: `patch:${id}`, method: "PATCH", url: `/api/admin/categories/${id}`, body });
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...body } : row)));
  }

  async function del(id: string) {
    const target = rows.find((r) => r.id === id);
    if (!target) return;
    if (!window.confirm(`Delete "${target.name}"? This can't be undone.`)) return;
    const ok = await call({
      op: `del:${id}`,
      method: "DELETE",
      url: `/api/admin/categories/${id}`,
    });
    if (ok) setRows((r) => r.filter((row) => row.id !== id));
  }

  const byGroup = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const arr = map.get(r.groupName) ?? [];
      arr.push(r);
      map.set(r.groupName, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* Add form */}
      <section className="card p-5">
        <h2 className="font-display text-base font-semibold">Add a category</h2>
        <p className="mt-1 text-xs text-ink-500">
          The group decides which homepage rail this category appears under. Choose <em>MATERIAL</em> if it&rsquo;s a fabric or sewing/tailoring supply so it lands on the materials rail.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_180px_140px_auto]">
          <input
            className="input"
            placeholder="e.g. Aso Oke"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            list="cat-groups"
            className="input"
            placeholder="Group"
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
          />
          <datalist id="cat-groups">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
          <select
            className="input"
            value={newKind}
            onChange={(e) => setNewKind(e.target.value as "MATERIAL" | "PRODUCT")}
          >
            <option value="PRODUCT">Finished product</option>
            <option value="MATERIAL">Material / supply</option>
          </select>
          <button className="btn-primary" onClick={add} disabled={busy === "add" || !newName.trim()}>
            {busy === "add" ? "Adding…" : "Add"}
          </button>
        </div>
      </section>

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* Existing categories grouped */}
      {byGroup.map(([group, cats]) => (
        <section key={group}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-500">
            {group} ({cats.length})
          </h2>
          <ul className="card divide-y divide-ink-100">
            {cats.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 p-3">
                <input
                  className="input min-w-[180px] flex-1"
                  defaultValue={c.name}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== c.name) patch(c.id, { name: v });
                  }}
                />
                <input
                  list="cat-groups"
                  className="input w-[140px]"
                  defaultValue={c.groupName}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== c.groupName) patch(c.id, { groupName: v });
                  }}
                />
                <select
                  className="input w-[120px]"
                  defaultValue={c.kind}
                  onChange={(e) => patch(c.id, { kind: e.target.value as "MATERIAL" | "PRODUCT" })}
                >
                  <option value="PRODUCT">Product</option>
                  <option value="MATERIAL">Material</option>
                </select>
                <input
                  type="number"
                  className="input w-[80px]"
                  defaultValue={c.displayOrder}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v !== c.displayOrder) {
                      patch(c.id, { displayOrder: v });
                    }
                  }}
                />
                <span className="text-[11px] text-ink-500">
                  {c.usage} product{c.usage === 1 ? "" : "s"}
                </span>
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={c.enabled}
                    onChange={(e) => patch(c.id, { enabled: e.target.checked })}
                  />
                  Enabled
                </label>
                <button
                  className="text-xs text-burgundy-700 hover:underline"
                  onClick={() => del(c.id)}
                  disabled={c.usage > 0 || busy === `del:${c.id}`}
                  title={c.usage > 0 ? "Disable instead — products still reference this category." : ""}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
