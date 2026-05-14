// Currency localisation for StreekMart — shared types + pure formatter.
//
// This file is safe for both client and server bundles. The server-only
// detector lives in src/lib/currencyServer.ts (which imports next/headers)
// — keep that import out of here so the Price client component can pull
// `formatPriceFrom` and `DEFAULT_USD_CTX` without dragging next/headers
// into the client bundle.
//
// Prices are stored in USD on every Product/Order row. Display goes through
// `getServerCurrencyContext()` server-side and the matching <CurrencyProvider>
// + <Price> components on the client.

export type CurrencyDefinition = {
  code: string;        // ISO-4217
  symbol: string;
  locale: string;      // BCP-47 used by Intl.NumberFormat
  country: string;     // ISO-3166 alpha-2 (the "home" country, for the selector flag)
  name: string;
  flag: string;        // Twemoji flag (renders cleanly in any browser)
};

// Curated short list — the top global currencies plus the Africa-focused ones
// that match StreekMart's seed seller geography. Easy to extend.
export const CURRENCIES: CurrencyDefinition[] = [
  { code: "USD", symbol: "$",   locale: "en-US", country: "US", name: "US Dollar",          flag: "🇺🇸" },
  { code: "EUR", symbol: "€",   locale: "de-DE", country: "EU", name: "Euro",                flag: "🇪🇺" },
  { code: "GBP", symbol: "£",   locale: "en-GB", country: "GB", name: "British Pound",       flag: "🇬🇧" },
  { code: "NGN", symbol: "₦",   locale: "en-NG", country: "NG", name: "Nigerian Naira",      flag: "🇳🇬" },
  { code: "ZAR", symbol: "R",   locale: "en-ZA", country: "ZA", name: "South African Rand",  flag: "🇿🇦" },
  { code: "KES", symbol: "KSh", locale: "en-KE", country: "KE", name: "Kenyan Shilling",     flag: "🇰🇪" },
  { code: "GHS", symbol: "₵",   locale: "en-GH", country: "GH", name: "Ghanaian Cedi",       flag: "🇬🇭" },
  { code: "CAD", symbol: "C$",  locale: "en-CA", country: "CA", name: "Canadian Dollar",     flag: "🇨🇦" },
  { code: "AUD", symbol: "A$",  locale: "en-AU", country: "AU", name: "Australian Dollar",   flag: "🇦🇺" },
  { code: "INR", symbol: "₹",   locale: "en-IN", country: "IN", name: "Indian Rupee",        flag: "🇮🇳" },
  { code: "JPY", symbol: "¥",   locale: "ja-JP", country: "JP", name: "Japanese Yen",        flag: "🇯🇵" },
  { code: "CNY", symbol: "¥",   locale: "zh-CN", country: "CN", name: "Chinese Yuan",        flag: "🇨🇳" },
  { code: "BRL", symbol: "R$",  locale: "pt-BR", country: "BR", name: "Brazilian Real",      flag: "🇧🇷" },
  { code: "AED", symbol: "AED", locale: "en-AE", country: "AE", name: "UAE Dirham",          flag: "🇦🇪" },
];

export const COOKIE_NAME = "upclo_currency";

// Currencies that don't use minor units (no decimals). Mostly Asian.
const NO_MINOR_UNITS = new Set(["JPY", "KRW", "VND", "IDR", "HUF", "CLP"]);

export type CurrencyContext = {
  code: string;
  symbol: string;
  locale: string;
  flag: string;
  /** USD → code multiplier. 1 USD == rate × code. */
  rate: number;
};

// Default USD context — used by the client provider as its initial value
// before hydration replaces it with the server-derived one.
export const DEFAULT_USD_CTX: CurrencyContext = {
  code: "USD",
  symbol: "$",
  locale: "en-US",
  flag: "🇺🇸",
  rate: 1,
};

// Pure formatter — usable on either side. Prices are stored in USD.
export function formatPriceFrom(amountUsd: number, ctx: CurrencyContext): string {
  const local = amountUsd * ctx.rate;
  const fractionDigits = NO_MINOR_UNITS.has(ctx.code) ? 0 : 2;
  try {
    return new Intl.NumberFormat(ctx.locale, {
      style: "currency",
      currency: ctx.code,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(local);
  } catch {
    // Some locales / currencies aren't supported on every Node build —
    // bail out to "₦ 1,234.56" style.
    return `${ctx.symbol} ${local.toFixed(fractionDigits)}`;
  }
}
