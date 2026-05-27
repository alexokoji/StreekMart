"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Price } from "@/components/Price";
import { type PickedAddress } from "@/components/forms/GooglePlacesPicker";
import { SavedAddressPicker } from "@/components/forms/SavedAddressPicker";

type PaymentMethod = "DIRECT" | "ON_DELIVERY";

export function CheckoutForm({
  sellers,
  subtotal,
}: {
  sellers?: { id: string; city?: string | null; country?: string | null; region?: string | null; name?: string | null; sellerVerified?: boolean }[];
  subtotal?: number;
}) {
  const router = useRouter();
  // The cart page passes the buyer's zone override through the URL (?zone=
  // within|outside). We forward it on the POST body so the server quote
  // matches what the buyer saw on the cart summary.
  const searchParams = useSearchParams();
  const zoneOverride =
    searchParams?.get("zone") === "within"
      ? "WITHIN_CITY"
      : searchParams?.get("zone") === "outside"
        ? "OUTSIDE_CITY"
        : undefined;
  const [shippingAddress, setShippingAddress] = useState<PickedAddress | null>(null);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("DIRECT");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState<{city?: string; country?: string; region?: string} | null>(null);
  // Per-seller rates + selections
  const [ratesBySeller, setRatesBySeller] = useState<Record<string, any[] | null>>({});
  const [errorBySeller, setErrorBySeller] = useState<Record<string, string | null>>({});
  const [selectedBySeller, setSelectedBySeller] = useState<Record<string, string | null>>({});

  function normalisedCity(s?: string | null) {
    return (s || "").trim().toLowerCase();
  }

  function selectedRateForSeller(sellerId: string) {
    const rs = ratesBySeller[sellerId];
    const sel = selectedBySeller[sellerId];
    return rs?.find((r) => r.id === sel) ?? null;
  }


  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!shippingAddress?.formattedAddress) {
      setErr("Please pick a shipping address from the map.");
      return;
    }
    setBusy(true);
    try {
      const body: any = {
        shippingAddress: shippingAddress.formattedAddress,
        shippingFormattedAddress: shippingAddress.formattedAddress,
        shippingLatitude: shippingAddress.latitude || undefined,
        shippingLongitude: shippingAddress.longitude || undefined,
        shippingPlaceId: shippingAddress.placeId || undefined,
        notes: notes || undefined,
        paymentMethod,
        zoneOverride,
      };

      // Collect per-seller shippingChoices from selections
      const shippingChoices: any[] = [];
      if (sellers && sellers.length > 0) {
        for (const s of sellers) {
          const selId = selectedBySeller[s.id];
          if (!selId) continue;
          const rate = ratesBySeller[s.id]?.find((r) => r.id === selId);
          if (!rate) continue;
          shippingChoices.push({
            sellerId: s.id,
            provider: rate.provider || "SHIPBUBBLE",
            courierId: rate.id,
            courierName: rate.name,
            priceCents: rate.price ?? null,
            estimatedDays: rate.estimatedDays ?? null,
          });
        }
      }
      if (shippingChoices.length > 0) body.shippingChoices = shippingChoices;

      const res = await fetch("/api/cart/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Checkout failed");
        return;
      }
      // Live payment gateway returns a hosted-checkout URL; stub mode returns just
      // the paymentReference. Either way the buyer ends up on the return
      // page where the order group resolves.
      if (typeof data.redirectUrl === "string" && data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      router.replace(`/cart/checkout/return?ref=${encodeURIComponent(data.paymentReference)}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!mounted) return;
        // API returns { user: {...} }, extract the user object
        setMe(data?.user || null);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch per-seller Sendbox rates when we have buyer location and sellers.
  // Always use Sendbox for deliveries outside the seller's city. If the
  // delivery is within the seller's city, the seller handles delivery
  // themselves (no external rates shown).
  useEffect(() => {
    if (!sellers || sellers.length === 0 || !me) return;
    // Don't burn API quota until the buyer has picked a real delivery address —
    // rates depend on a precise endpoint, and Shipbubble's validator rejects
    // vague city-only fallbacks.
    if (!shippingAddress?.formattedAddress) return;

    let mounted = true;
    (async () => {
      for (const s of sellers) {
        const sellerId = s.id;
        const sellerCity = s.city;

        if (!sellerCity) {
          setRatesBySeller((prev) => ({ ...prev, [sellerId]: [] }));
          continue;
        }

        const isOutside =
          zoneOverride === "OUTSIDE_CITY" ||
          (me.city && normalisedCity(me.city) !== normalisedCity(sellerCity));

        if (!isOutside) {
          setRatesBySeller((prev) => ({ ...prev, [sellerId]: [] }));
          continue;
        }

        setRatesBySeller((prev) => ({ ...prev, [sellerId]: null }));
        setErrorBySeller((prev) => ({ ...prev, [sellerId]: null }));
        try {
          const payload: Record<string, unknown> = {
            provider: "SHIPBUBBLE",
            sellerId: s.id,
            pickupCity: sellerCity,
            pickupState: s.region || "",
            pickupCountry: s.country || "",
            deliveryCity: me.city || "",
            deliveryState: me.region || "",
            deliveryCountry: me.country || "",
            description: "Order from UpClo",
            deliveryFormattedAddress: shippingAddress.formattedAddress,
            deliveryPlaceId: shippingAddress.placeId || undefined,
            deliveryLatitude: shippingAddress.latitude || undefined,
            deliveryLongitude: shippingAddress.longitude || undefined,
          };
          const res = await fetch("/api/logistics/rates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const d = await res.json();
          if (!mounted) return;
          if (d?.ok && Array.isArray(d.rates)) {
            setRatesBySeller((prev) => ({ ...prev, [sellerId]: d.rates }));
          } else {
            setRatesBySeller((prev) => ({ ...prev, [sellerId]: [] }));
            setErrorBySeller((prev) => ({
              ...prev,
              [sellerId]: d?.error ?? "Couldn't fetch shipping options.",
            }));
          }
        } catch (err) {
          if (!mounted) return;
          setRatesBySeller((prev) => ({ ...prev, [sellerId]: [] }));
          setErrorBySeller((prev) => ({
            ...prev,
            [sellerId]: err instanceof Error ? err.message : "Network error",
          }));
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [sellers, me, zoneOverride, shippingAddress?.placeId, shippingAddress?.formattedAddress]);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label">Shipping address</label>
        <SavedAddressPicker
          kind="DELIVERY"
          value={shippingAddress}
          onChange={(picked) => setShippingAddress(picked)}
          countryRestriction={(me?.country || "NG").toLowerCase()}
          required
        />
      </div>
      <div>
        <label className="label">Order notes <span className="text-xs text-gray-400">(optional)</span></label>
        <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <fieldset className="space-y-2">
        <legend className="label">Payment method</legend>

        <label
          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
            paymentMethod === "DIRECT"
              ? "border-violet-500 bg-violet-50/40"
              : "border-ink-200 hover:bg-ink-50"
          }`}
        >
          <input
            type="radio"
            name="paymentMethod"
            value="DIRECT"
            checked={paymentMethod === "DIRECT"}
            onChange={() => setPaymentMethod("DIRECT")}
            className="mt-0.5 h-4 w-4"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium">Pay now (card, bank, or transfer)</p>
            <p className="text-xs text-ink-500">
              You&apos;ll be redirected to a secure payment page. Funds are held until you
              confirm delivery.
            </p>
          </div>
        </label>

        <label
          aria-disabled="true"
          title="Coming soon — Pay on Delivery is being rolled out to trusted buyers first."
          className="flex cursor-not-allowed items-start gap-3 rounded-xl border border-dashed border-ink-200 bg-ink-50/60 p-3 opacity-70"
        >
          <input
            type="radio"
            name="paymentMethod"
            value="ON_DELIVERY"
            disabled
            className="mt-0.5 h-4 w-4"
          />
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium text-ink-700">
              Pay on Delivery
              <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold-700">
                Coming soon
              </span>
            </p>
            <p className="text-xs text-ink-500">
              Pay cash when the courier arrives. We&apos;re rolling this out to trusted
              buyers first — complete a few delivered orders to qualify.
            </p>
          </div>
        </label>
      </fieldset>

      {sellers && sellers.length > 0 && (
        <div>
          <label className="label">Delivery options</label>
          <div className="space-y-4">
            {sellers.map((s) => {
              const rs = ratesBySeller[s.id];
              const sel = selectedBySeller[s.id] ?? null;
              const selRate = selectedRateForSeller(s.id);
              
              // Find cheapest, fastest, and recommended rates in list
              let cheapestId: string | null = null;
              let fastestId: string | null = null;
              let recommendedId: string | null = null;
              
              if (Array.isArray(rs) && rs.length > 0) {
                let cheapest = rs[0];
                let fastest = rs[0];
                for (const r of rs) {
                  if ((r.price || 0) < (cheapest.price || 0)) cheapest = r;
                  if ((r.estimatedDays || 99) < (fastest.estimatedDays || 99)) fastest = r;
                }
                cheapestId = cheapest.id;
                fastestId = fastest.id;
                
                const fastestRates = rs.filter(r => r.estimatedDays === fastest.estimatedDays);
                const recommended = fastestRates.reduce((best, r) => (r.price || 0) < (best.price || 0) ? r : best, fastestRates[0]);
                recommendedId = recommended.id;
              }

              const ratesError = errorBySeller[s.id];
              return (
                <div key={s.id} className="p-3 border rounded-lg">
                  <p className="text-sm font-medium">Seller: {s.name ?? s.id}</p>
                  {!shippingAddress?.formattedAddress && (
                    <p className="text-xs text-gray-500">
                      Pick a delivery address above to see shipping options.
                    </p>
                  )}
                  {shippingAddress?.formattedAddress && rs === undefined && (
                    <p className="text-xs text-gray-500">Not checked</p>
                  )}
                  {rs === null && <p className="text-xs text-gray-500">Loading shipping options…</p>}
                  {Array.isArray(rs) && rs.length === 0 && !ratesError && (
                    <p className="text-sm text-gray-500">
                      No external shipping options — seller will handle delivery.
                    </p>
                  )}
                  {ratesError && (
                    <p className="text-sm text-amber-700">{ratesError}</p>
                  )}
                  {Array.isArray(rs) && rs.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {rs.map((r: any) => (
                        <label key={r.id} className={`flex items-center gap-3 rounded-xl border p-3 ${sel === r.id ? "border-violet-500 bg-violet-50/40" : "border-ink-200"}`}>
                          <input type="radio" name={`courier_${s.id}`} value={r.id} checked={sel === r.id} onChange={() => setSelectedBySeller((p) => ({ ...p, [s.id]: r.id }))} className="mt-0.5 h-4 w-4" />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="text-sm font-medium">{r.name}</p>
                              {r.id === cheapestId && (
                                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">Cheapest</span>
                              )}
                              {r.id === fastestId && (
                                <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold text-sky-700">Fastest</span>
                              )}
                              {r.id === recommendedId && (
                                <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700">Recommended</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">Estimated: {r.estimatedDays ?? "—"} days ({r.eta || ""})</p>
                          </div>
                          <div className="ml-auto font-semibold"><Price amount={((r.price ?? 0) / 100)} /></div>
                        </label>
                      ))}
                    </div>
                  )}
                  {selRate && (
                    <div className="mt-3 flex items-center justify-between border-t pt-3">
                      <span className="text-sm">Selected delivery</span>
                      <span className="font-semibold"><Price amount={((selRate.price ?? 0) / 100)} /></span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {subtotal != null && (
            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <span className="font-medium">Total (incl. selected delivery)</span>
              <span className="font-bold">
                <Price amount={subtotal + Object.keys(selectedBySeller).reduce((acc, sid) => {
                  const r = selectedRateForSeller(sid);
                  return acc + ((r?.price ?? 0) / 100);
                }, 0)} />
              </span>
            </div>
          )}
        </div>
      )}

      {err && <p className="text-sm text-red-600">{err}</p>}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Starting payment…" : "Pay & place orders"}
      </button>
    </form>
  );
}
