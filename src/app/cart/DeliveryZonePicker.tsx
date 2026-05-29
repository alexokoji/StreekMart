"use client";

import { useRouter, useSearchParams } from "next/navigation";

// Buyer-driven override for the delivery zone calculation. Defaults to
// "auto" (use the buyer's saved profile city/country). Override is stored
// in the URL `?zone=within|outside` so the cart page can read it
// server-side and re-quote on a router.refresh().
//
// International is intentionally NOT offered — cross-country orders are
// blocked at checkout regardless of any override.
export function DeliveryZonePicker({ current }: { current: "AUTO" | "WITHIN_CITY" | "OUTSIDE_CITY" }) {
  const router = useRouter();
  const params = useSearchParams();

  function set(next: "AUTO" | "WITHIN_CITY" | "OUTSIDE_CITY") {
    const sp = new URLSearchParams(params?.toString() ?? "");
    if (next === "AUTO") sp.delete("zone");
    else if (next === "WITHIN_CITY") sp.set("zone", "within");
    else sp.set("zone", "outside");
    const qs = sp.toString();
    router.replace(`/cart${qs ? `?${qs}` : ""}`);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-ink-100 bg-ink-50/40 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-500">
        Delivering to
      </p>
      <p className="mt-0.5 text-[11px] text-ink-500">
        Override if you&apos;re shipping somewhere other than your saved address.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Chip active={current === "AUTO"} onClick={() => set("AUTO")} label="Use my address" />
        <Chip
          active={current === "WITHIN_CITY"}
          onClick={() => set("WITHIN_CITY")}
          label="Same city as seller"
        />
        {/* "Outside seller's city" chip removed — the courier rate engine
            already detects an out-of-city route from the buyer's address vs.
            the seller's city; surfacing an extra manual override here just
            confused buyers into picking it unnecessarily. */}
      </div>
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
        active
          ? "border-violet-500 bg-violet-100 text-violet-800"
          : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
      }`}
    >
      {label}
    </button>
  );
}
