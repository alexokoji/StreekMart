"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES } from "@/lib/location";

export function CityForm() {
  const router = useRouter();
  const [country, setCountry] = useState("");
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [fee, setFee] = useState("0");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/delivery-cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country,
          name,
          region: region || undefined,
          feeCents: Math.round(Number(fee) * 100),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Couldn't add the city.");
        return;
      }
      setName("");
      setRegion("");
      setFee("0");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-4">
      <div>
        <label className="label">Country</label>
        <select className="input" required value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">Select…</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">City</label>
        <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lagos" />
      </div>
      <div>
        <label className="label">Region (optional)</label>
        <input className="input" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. Lagos State" />
      </div>
      <div>
        <label className="label">Fee (USD)</label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-500">$</span>
          <input
            type="number"
            min={0}
            step="0.01"
            required
            className="input pl-8"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
        </div>
      </div>
      {err && <p className="text-sm text-burgundy-700 sm:col-span-4">{err}</p>}
      <div className="sm:col-span-4 flex justify-end">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Adding…" : "Add city"}
        </button>
      </div>
    </form>
  );
}
