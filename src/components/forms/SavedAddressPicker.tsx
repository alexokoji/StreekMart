"use client";

import { useCallback, useEffect, useState } from "react";
import { GooglePlacesPicker, type PickedAddress } from "./GooglePlacesPicker";

export type AddressKind = "DELIVERY" | "PICKUP";

type SavedAddress = {
  id: string;
  kind: AddressKind;
  label: string | null;
  phone: string | null;
  formattedAddress: string;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  region: string | null;
  country: string | null;
  isDefault: boolean;
};

type Props = {
  kind: AddressKind;
  value: PickedAddress | null;
  onChange: (picked: PickedAddress | null, savedAddressId?: string) => void;
  countryRestriction?: string;
  required?: boolean;
  // Auto-save new pick to the user's address book. Default true.
  autoSaveNewPicks?: boolean;
};

export function SavedAddressPicker({
  kind,
  value,
  onChange,
  countryRestriction,
  required,
  autoSaveNewPicks = true,
}: Props) {
  const [saved, setSaved] = useState<SavedAddress[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // "list" = showing saved addresses, "new" = showing the GooglePlacesPicker
  const [mode, setMode] = useState<"list" | "new">("list");
  const [saveOnSubmit, setSaveOnSubmit] = useState(true);

  // Initial fetch
  useEffect(() => {
    let mounted = true;
    fetch(`/api/account/addresses?kind=${kind}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!mounted) return;
        const list: SavedAddress[] = data?.addresses ?? [];
        setSaved(list);
        const def = list.find((a) => a.isDefault) ?? list[0];
        if (def) {
          setSelectedId(def.id);
          setMode("list");
          onChange(savedToPicked(def), def.id);
        } else {
          setMode("new");
        }
      })
      .catch(() => {
        if (!mounted) return;
        setSaved([]);
        setMode("new");
      });
    return () => {
      mounted = false;
    };
    // Run once for this kind; parent's onChange identity isn't required to retrigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const handleSelectSaved = useCallback(
    (a: SavedAddress) => {
      setSelectedId(a.id);
      onChange(savedToPicked(a), a.id);
    },
    [onChange],
  );

  const handleNewPick = useCallback(
    async (picked: PickedAddress | null) => {
      if (!picked) {
        onChange(null);
        return;
      }
      // Optionally persist the new pick. We do it inline so the checkout can
      // reference the saved id when the user submits.
      if (autoSaveNewPicks && saveOnSubmit && picked.placeId) {
        try {
          const res = await fetch("/api/account/addresses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind,
              formattedAddress: picked.formattedAddress,
              placeId: picked.placeId,
              latitude: picked.latitude,
              longitude: picked.longitude,
              // Empty list before this means the API will mark this default automatically.
              isDefault: (saved?.length ?? 0) === 0,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.address) {
              setSaved((prev) => [data.address, ...(prev ?? [])]);
              setSelectedId(data.address.id);
              onChange(picked, data.address.id);
              setMode("list");
              return;
            }
          }
        } catch {
          // Non-fatal: parent still gets the picked address, just unsaved.
        }
      }
      onChange(picked);
    },
    [autoSaveNewPicks, saveOnSubmit, saved, kind, onChange],
  );

  if (saved === null) {
    return <p className="text-xs text-ink-500">Loading saved addresses…</p>;
  }

  if (mode === "new" || saved.length === 0) {
    return (
      <div className="space-y-3">
        <GooglePlacesPicker
          value={value}
          onChange={handleNewPick}
          countryRestriction={countryRestriction}
          required={required}
        />
        {autoSaveNewPicks && (
          <label className="flex items-center gap-2 text-xs text-ink-600">
            <input
              type="checkbox"
              checked={saveOnSubmit}
              onChange={(e) => setSaveOnSubmit(e.target.checked)}
            />
            Save this address for future orders
          </label>
        )}
        {saved.length > 0 && (
          <button
            type="button"
            className="text-xs text-violet-600 underline"
            onClick={() => setMode("list")}
          >
            ← Use a saved address instead
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {saved.map((a) => (
          <li key={a.id}>
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                selectedId === a.id ? "border-violet-500 bg-violet-50/40" : "border-ink-200"
              }`}
            >
              <input
                type="radio"
                name={`saved-address-${kind}`}
                checked={selectedId === a.id}
                onChange={() => handleSelectSaved(a)}
                className="mt-0.5 h-4 w-4"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-medium text-ink-700">
                    {a.label || a.city || "Address"}
                  </p>
                  {a.isDefault && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-500">{a.formattedAddress}</p>
              </div>
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="text-sm text-violet-600 underline"
        onClick={() => {
          setSelectedId(null);
          onChange(null);
          setMode("new");
        }}
      >
        + Add a new address
      </button>
    </div>
  );
}

function savedToPicked(a: SavedAddress): PickedAddress {
  return {
    formattedAddress: a.formattedAddress,
    placeId: a.placeId ?? "",
    latitude: a.latitude ?? 0,
    longitude: a.longitude ?? 0,
  };
}
