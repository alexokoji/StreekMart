"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Seller-side delivery rate editor. Three buckets — within city, outside
// city (same country), outside country — match the zone resolution in
// src/lib/location.ts. Inputs are in dollars-as-floats for ergonomics; the
// endpoint receives integer cents.
export function DeliveryFeesForm({
  initial,
}: {
  initial: {
    withinCityCents: number;
    outsideCityCents: number;
    outsideCountryCents: number;
  };
}) {
  const router = useRouter();
  const [withinCity, setWithinCity] = useState((initial.withinCityCents / 100).toFixed(2));
  const [outsideCity, setOutsideCity] = useState((initial.outsideCityCents / 100).toFixed(2));
  const [outsideCountry, setOutsideCountry] = useState((initial.outsideCountryCents / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function toCents(v: string): number {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return -1;
    return Math.round(n * 100);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const w = toCents(withinCity);
    const o = toCents(outsideCity);
    const oc = toCents(outsideCountry);
    if (w < 0 || o < 0 || oc < 0) {
      setMsg({ kind: "err", text: "Use a non-negative number for every rate." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/account/delivery-fees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withinCity: w, outsideCity: o, outsideCountry: oc }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: "err", text: data.error ?? "Couldn't save rates." });
        return;
      }
      setMsg({ kind: "ok", text: "Delivery rates updated." });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Within your city"
          help="Shown to buyers in the same city as you."
          value={withinCity}
          onChange={setWithinCity}
        />
        <Field
          label="Outside city, same country"
          help="Shown to buyers in your country but a different city."
          value={outsideCity}
          onChange={setOutsideCity}
        />
        <Field
          label="International"
          help="Shown to buyers in a different country."
          value={outsideCountry}
          onChange={setOutsideCountry}
        />
      </div>
      {msg && (
        <p
          className={`text-sm ${
            msg.kind === "ok" ? "text-emerald-accent" : "text-burgundy-700"
          }`}
        >
          {msg.text}
        </p>
      )}
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save rates"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-500">$</span>
        <input
          type="number"
          min={0}
          step="0.01"
          className="input pl-8"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <p className="mt-1 text-[11px] text-ink-500">{help}</p>
    </div>
  );
}
