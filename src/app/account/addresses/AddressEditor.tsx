"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Row = {
  id: string;
  label: string;
  phone: string;
  formattedAddress: string;
  city: string;
  region: string;
  country: string;
  isDefault: boolean;
};

const EMPTY: Omit<Row, "id"> = {
  label: "",
  phone: "",
  formattedAddress: "",
  city: "",
  region: "",
  country: "",
  isDefault: false,
};

export function AddressEditor({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial);
  const [draft, setDraft] = useState<Omit<Row, "id">>({ ...EMPTY });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    if (!draft.formattedAddress.trim()) return;
    setBusy("add");
    setErr(null);
    try {
      const res = await fetch("/api/account/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "DELIVERY",
          label: draft.label || undefined,
          phone: draft.phone || undefined,
          formattedAddress: draft.formattedAddress,
          city: draft.city || undefined,
          region: draft.region || undefined,
          country: draft.country || undefined,
          isDefault: draft.isDefault,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Could not save address.");
        return;
      }
      setRows((r) => [
        {
          id: data.address.id,
          label: data.address.label ?? "",
          phone: data.address.phone ?? "",
          formattedAddress: data.address.formattedAddress,
          city: data.address.city ?? "",
          region: data.address.region ?? "",
          country: data.address.country ?? "",
          isDefault: data.address.isDefault,
        },
        ...r,
      ]);
      setDraft({ ...EMPTY });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function setDefault(id: string) {
    setBusy(id);
    try {
      await fetch(`/api/account/addresses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      setRows((r) => r.map((x) => ({ ...x, isDefault: x.id === id })));
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this address?")) return;
    setBusy(id);
    try {
      await fetch(`/api/account/addresses/${id}`, { method: "DELETE" });
      setRows((r) => r.filter((x) => x.id !== id));
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="font-display text-base font-semibold">Add new address</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input className="input" placeholder="Label (Home, Office)" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          <input className="input" placeholder="Phone (optional)" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          <textarea className="input sm:col-span-2 min-h-[60px]" placeholder="Street, area, city, postcode" value={draft.formattedAddress} onChange={(e) => setDraft({ ...draft, formattedAddress: e.target.value })} />
          <input className="input" placeholder="City" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
          <input className="input" placeholder="Region / state" value={draft.region} onChange={(e) => setDraft({ ...draft, region: e.target.value })} />
          <input className="input" placeholder="Country (e.g. NG)" maxLength={3} value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value.toUpperCase() })} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.isDefault} onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })} />
            Make default
          </label>
        </div>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        <button className="btn-primary mt-3" onClick={add} disabled={busy === "add" || !draft.formattedAddress.trim()}>
          {busy === "add" ? "Saving..." : "Save address"}
        </button>
      </section>

      {rows.length === 0 ? (
        <div className="card p-6 text-center text-sm text-ink-500">
          No addresses yet. Add your first one above.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((a) => (
            <li key={a.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{a.label || "Address"}</span>
                    {a.isDefault && <span className="badge bg-emerald-50 text-emerald-700">Default</span>}
                  </div>
                  <p className="mt-1 text-sm text-ink-700">{a.formattedAddress}</p>
                  <p className="mt-1 text-xs text-ink-500">
                    {[a.city, a.region, a.country].filter(Boolean).join(", ")}
                    {a.phone ? ` - ${a.phone}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1 text-xs">
                  {!a.isDefault && (
                    <button onClick={() => setDefault(a.id)} disabled={busy === a.id} className="text-violet-700 hover:underline">
                      Set default
                    </button>
                  )}
                  <button onClick={() => remove(a.id)} disabled={busy === a.id} className="text-burgundy-700 hover:underline">
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}