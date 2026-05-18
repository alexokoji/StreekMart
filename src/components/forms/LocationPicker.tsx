"use client";

import { useMemo } from "react";
import { Country, State, City } from "country-state-city";
import { COUNTRIES } from "@/lib/location";

// Cascading country → state → city picker.
//
// Country list is intersected with our supported COUNTRIES whitelist (so
// admins control which markets are live). Once a country is picked, states
// auto-load from the country-state-city dataset; once a state is picked,
// cities populate. No manual entry — the buyer can only pick from the
// dataset, which keeps shipping zones consistent.
//
// `country-state-city` is bundled (~7 MB) but only loads on screens that
// import this component (register page, account settings). Next.js code-
// splits it automatically — no impact on the homepage.

type Value = {
  country: string;  // ISO-3166 alpha-2
  region: string;   // ISO state code (e.g. "LA" for Lagos in NG)
  city: string;     // city name
};

export function LocationPicker({
  value,
  onChange,
  required = true,
}: {
  value: Value;
  onChange: (next: Value) => void;
  required?: boolean;
}) {
  // Restrict to the supported COUNTRIES list — picked into a Set once so
  // the dropdown can render only supported entries.
  const supportedCodes = useMemo(() => new Set(COUNTRIES.map((c) => c.code)), []);

  // States + cities cache derived from the current country / state.
  // Using useMemo keeps these cheap — country-state-city ships JSON, no I/O.
  const states = useMemo(() => {
    if (!value.country) return [] as { isoCode: string; name: string }[];
    return State.getStatesOfCountry(value.country) ?? [];
  }, [value.country]);

  const cities = useMemo(() => {
    if (!value.country || !value.region) return [] as { name: string }[];
    return City.getCitiesOfState(value.country, value.region) ?? [];
  }, [value.country, value.region]);

  // When a country has 0 states or 0 cities in the dataset, fall back to a
  // text input for that level so the user isn't blocked. Rare for our
  // supported countries but plays it safe.
  const noStates = !!value.country && states.length === 0;
  const noCities = !!value.region && cities.length === 0;

  function update(patch: Partial<Value>) {
    const next = { ...value, ...patch };
    // Reset downstream fields when an upstream one changes.
    if ("country" in patch) {
      next.region = "";
      next.city = "";
    } else if ("region" in patch) {
      next.city = "";
    }
    onChange(next);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="label">Country</label>
        <select
          className="input"
          required={required}
          value={value.country}
          onChange={(e) => update({ country: e.target.value })}
        >
          <option value="">Select…</option>
          {Country.getAllCountries()
            .filter((c) => supportedCodes.has(c.isoCode))
            .map((c) => (
              <option key={c.isoCode} value={c.isoCode}>
                {c.flag} {c.name}
              </option>
            ))}
        </select>
      </div>

      <div>
        <label className="label">State / Region</label>
        {noStates ? (
          <input
            type="text"
            className="input"
            value={value.region}
            onChange={(e) => update({ region: e.target.value })}
            placeholder="Type your state"
            required={required}
            maxLength={80}
          />
        ) : (
          <select
            className="input"
            required={required}
            disabled={!value.country}
            value={value.region}
            onChange={(e) => update({ region: e.target.value })}
          >
            <option value="">
              {value.country ? "Select…" : "Pick a country first"}
            </option>
            {states.map((s) => (
              <option key={s.isoCode} value={s.isoCode}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="sm:col-span-2">
        <label className="label">City</label>
        {noCities ? (
          <input
            type="text"
            className="input"
            value={value.city}
            onChange={(e) => update({ city: e.target.value })}
            placeholder="Type your city"
            required={required}
            maxLength={80}
          />
        ) : (
          <select
            className="input"
            required={required}
            disabled={!value.region}
            value={value.city}
            onChange={(e) => update({ city: e.target.value })}
          >
            <option value="">
              {value.region ? "Select…" : "Pick a state first"}
            </option>
            {cities.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        {noCities && value.region && (
          <p className="mt-1 text-[11px] text-ink-500">
            City list isn&apos;t in our dataset for this region — type it manually.
          </p>
        )}
      </div>
    </div>
  );
}

// Suppress unused-warning when consumers only need the type.
export type LocationValue = Value;
