"use client";

import { useEffect, useState } from "react";
import { GooglePlacesPicker, type PickedAddress } from "./GooglePlacesPicker";
import type { AddressKind } from "./SavedAddressPicker";

type SavedAddress = {
  id: string;
  kind: AddressKind;
  label: string | null;
  phone: string | null;
  formattedAddress: string;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
};

type Props = {
  kind: AddressKind;
  title?: string;
  emptyHint?: string;
  countryRestriction?: string;
};

export function AddressBookManager({
  kind,
  title,
  emptyHint,
  countryRestriction,
}: Props) {
  const [addresses, setAddresses] = useState<SavedAddress[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newPicked, setNewPicked] = useState<PickedAddress | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch(`/api/account/addresses?kind=${kind}`)
      .then((r) => (r.ok ? r.json() : { addresses: [] }))
      .then((d) => mounted && setAddresses(d.addresses ?? []))
      .catch(() => mounted && setAddresses([]));
    return () => {
      mounted = false;
    };
  }, [kind]);

  async function createAddress(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!newPicked?.formattedAddress) {
      setErr("Pick an address from the map first.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/account/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          label: newLabel || undefined,
          formattedAddress: newPicked.formattedAddress,
          placeId: newPicked.placeId || undefined,
          latitude: newPicked.latitude || undefined,
          longitude: newPicked.longitude || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Failed to save");
        return;
      }
      setAddresses((prev) => [data.address, ...(prev ?? [])]);
      setAdding(false);
      setNewLabel("");
      setNewPicked(null);
    } finally {
      setBusy(false);
    }
  }

  async function setDefault(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/account/addresses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) return;
      setAddresses((prev) =>
        (prev ?? []).map((a) => ({ ...a, isDefault: a.id === id })),
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteAddress(id: string) {
    if (!confirm("Delete this address?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/account/addresses/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      setAddresses((prev) => (prev ?? []).filter((a) => a.id !== id));
    } finally {
      setBusy(false);
    }
  }

  if (addresses === null) {
    return <p className="text-sm text-ink-500">Loading…</p>;
  }

  return (
    <section className="space-y-3">
      {title && <h3 className="text-sm font-semibold text-ink-800">{title}</h3>}

      {addresses.length === 0 && !adding && (
        <p className="text-sm text-ink-500">
          {emptyHint ??
            "You haven't saved any addresses yet. Add one to speed up checkout."}
        </p>
      )}

      {addresses.length > 0 && (
        <ul className="space-y-2">
          {addresses.map((a) => (
            <li
              key={a.id}
              className="flex items-start gap-3 rounded-xl border border-ink-200 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-medium text-ink-700">
                    {a.label || "Address"}
                  </p>
                  {a.isDefault && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-500">{a.formattedAddress}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {!a.isDefault && (
                  <button
                    type="button"
                    className="text-xs text-violet-600 underline"
                    onClick={() => setDefault(a.id)}
                    disabled={busy}
                  >
                    Make default
                  </button>
                )}
                <button
                  type="button"
                  className="text-xs text-red-600 underline"
                  onClick={() => deleteAddress(a.id)}
                  disabled={busy}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form
          onSubmit={createAddress}
          className="space-y-3 rounded-xl border border-ink-200 p-3"
        >
          <input
            type="text"
            className="input"
            placeholder="Label (e.g. Home, Office, Aba warehouse)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            maxLength={60}
          />
          <GooglePlacesPicker
            value={newPicked}
            onChange={setNewPicked}
            countryRestriction={countryRestriction}
            required
          />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              className="btn-primary"
              disabled={busy || !newPicked}
            >
              {busy ? "Saving…" : "Save address"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setAdding(false);
                setNewLabel("");
                setNewPicked(null);
                setErr(null);
              }}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="text-sm text-violet-600 underline"
          onClick={() => setAdding(true)}
        >
          + Add an address
        </button>
      )}
    </section>
  );
}
