// Server-only currency helpers. Imports next/headers, so this module must
// never be pulled into the client bundle. Client-safe primitives live in
// src/lib/currency.ts.

import { cookies, headers } from "next/headers";
import {
  COOKIE_NAME,
  CURRENCIES,
  type CurrencyContext,
} from "./currency";

const CURRENCY_BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

// Country → currency. Most EU members map to EUR; rest fall back to USD.
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: "USD",
  GB: "GBP", IE: "EUR", FR: "EUR", DE: "EUR", IT: "EUR", ES: "EUR", NL: "EUR",
  BE: "EUR", AT: "EUR", PT: "EUR", FI: "EUR", GR: "EUR", LU: "EUR", SK: "EUR",
  EE: "EUR", LV: "EUR", LT: "EUR", SI: "EUR", CY: "EUR", MT: "EUR", HR: "EUR",
  NG: "NGN", ZA: "ZAR", KE: "KES", GH: "GHS",
  CA: "CAD", AU: "AUD", NZ: "AUD",
  IN: "INR",
  JP: "JPY",
  CN: "CNY", HK: "USD", TW: "USD", SG: "USD",
  BR: "BRL",
  AE: "AED", SA: "AED", QA: "AED", KW: "AED",
};

// Used when the live rates fetch fails. Approximate as of 2026-Q1.
// Not authoritative — the selector + the cache will overwrite this within
// the first successful fetch.
const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  NGN: 1500,
  ZAR: 18.5,
  KES: 130,
  GHS: 15.5,
  CAD: 1.36,
  AUD: 1.5,
  INR: 83,
  JPY: 150,
  CNY: 7.2,
  BRL: 5.0,
  AED: 3.67,
};

const FETCH_URL = "https://open.er-api.com/v6/latest/USD";
const RATE_TTL_MS = 24 * 60 * 60 * 1000;

let _cache: { rates: Record<string, number>; at: number } | null = null;

// Fetch + cache USD-base rates. Failures fall back to FALLBACK_RATES so the
// UI keeps working when offline or when the rate API is down.
async function getRates(): Promise<Record<string, number>> {
  if (_cache && Date.now() - _cache.at < RATE_TTL_MS) return _cache.rates;
  try {
    const res = await fetch(FETCH_URL, {
      // Lean on Next's data cache too — across multiple lambda instances it
      // amortises the call. The in-process cache above is just an extra
      // shortcut for the same lambda.
      next: { revalidate: 60 * 60 * 12 },
    });
    if (res.ok) {
      const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
      if (data.result === "success" && data.rates && typeof data.rates === "object") {
        _cache = { rates: data.rates, at: Date.now() };
        return data.rates;
      }
    }
  } catch {
    /* fall through */
  }
  return FALLBACK_RATES;
}

function pickCountry(): string | null {
  const h = headers();
  const country =
    h.get("x-vercel-ip-country") ??
    h.get("cf-ipcountry") ??
    h.get("x-country") ??
    null;
  if (country && country.length === 2) return country.toUpperCase();
  // Fall back to the country segment of accept-language.
  const lang = h.get("accept-language") ?? "";
  const m = lang.match(/[a-z]{2}-([A-Z]{2})/);
  return m ? m[1] : null;
}

// Server-side currency resolver. Used by layout.tsx (to feed the
// CurrencyProvider) and by anything that needs a fully-resolved context
// without going through React.
//
// Detection order:
//   1. `upclo_currency` cookie (set explicitly by the user via the selector)
//   2. Edge-geo header (Vercel `x-vercel-ip-country` or Cloudflare `cf-ipcountry`)
//   3. `accept-language` header — country segment of the BCP-47 locale
//   4. USD fallback
// Convert a price entered in `code` back to USD (the canonical storage
// currency). Uses the same cached rate table as the display path so a price
// the seller types in NGN round-trips reasonably to USD and back. The rate
// API is FX-grade — small drift over time is expected and acceptable.
//
// Throws if `code` isn't a known currency. Callers should validate first.
export async function convertToUsd(amount: number, code: string): Promise<number> {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("convertToUsd: amount must be a non-negative finite number");
  }
  const upper = code.toUpperCase();
  if (upper === "USD") return amount;
  if (!CURRENCY_BY_CODE.has(upper)) {
    throw new Error(`convertToUsd: unsupported currency "${code}"`);
  }
  const rates = await getRates();
  const rate = rates[upper] ?? FALLBACK_RATES[upper];
  if (!rate || rate <= 0) {
    throw new Error(`convertToUsd: no rate available for "${upper}"`);
  }
  return amount / rate;
}

export async function getServerCurrencyContext(): Promise<CurrencyContext> {
  // 1. cookie wins
  const cookieCode = cookies().get(COOKIE_NAME)?.value;
  let code = cookieCode && CURRENCY_BY_CODE.has(cookieCode) ? cookieCode : null;

  // 2. edge geo + accept-language fallback
  if (!code) {
    const country = pickCountry();
    if (country && COUNTRY_TO_CURRENCY[country]) code = COUNTRY_TO_CURRENCY[country];
  }

  // 3. final fallback
  if (!code || !CURRENCY_BY_CODE.has(code)) code = "USD";

  const def = CURRENCY_BY_CODE.get(code)!;
  const rates = await getRates();
  const rate = rates[def.code] ?? FALLBACK_RATES[def.code] ?? 1;

  return { code: def.code, symbol: def.symbol, locale: def.locale, flag: def.flag, rate };
}
