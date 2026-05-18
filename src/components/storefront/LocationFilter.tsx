"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { COUNTRIES, countryName } from "@/lib/location";

// Compact two-field filter (country + city) that writes to the URL so
// every server query that respects `?country=` / `?city=` re-runs. Live
// across the homepage and the feed page without duplicating the UI.
//
// Both fields are optional — clearing the country also clears the city.
// "Anywhere" (empty value) removes the filter entirely.
export function LocationFilter({ countries }: { countries?: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const country = search.get("country") ?? "";
  const city = search.get("city") ?? "";

  // Only show countries that actually have inventory if the caller passed
  // a derived list — otherwise show the full COUNTRIES whitelist.
  const options = countries && countries.length > 0
    ? COUNTRIES.filter((c) => countries.includes(c.code))
    : COUNTRIES;

  function update(next: { country?: string; city?: string }) {
    const params = new URLSearchParams(search.toString());
    if ("country" in next) {
      if (next.country) params.set("country", next.country);
      else {
        params.delete("country");
        params.delete("city");
      }
    }
    if ("city" in next) {
      if (next.city) params.set("city", next.city);
      else params.delete("city");
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">
        Location
      </p>
      <select
        value={country}
        onChange={(e) => update({ country: e.target.value })}
        className="rounded-full border border-ink-200 bg-white px-3 py-1 text-xs text-ink-700 hover:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
      >
        <option value="">Anywhere</option>
        {options.map((c) => (
          <option key={c.code} value={c.code}>{c.name}</option>
        ))}
      </select>
      {country && (
        <input
          type="text"
          value={city}
          placeholder="City (optional)"
          onChange={(e) => update({ city: e.target.value })}
          maxLength={80}
          className="rounded-full border border-ink-200 bg-white px-3 py-1 text-xs text-ink-700 placeholder:text-ink-400 hover:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
        />
      )}
      {(country || city) && (
        <button
          type="button"
          onClick={() => update({ country: "", city: "" })}
          className="text-[11px] font-medium text-violet-700 hover:underline"
        >
          Clear ({country ? countryName(country) : ""}{city ? ` · ${city}` : ""})
        </button>
      )}
    </div>
  );
}
