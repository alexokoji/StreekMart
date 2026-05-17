// Product pricing units.
//
// `Product.unit` stores one of these strings. The price is always quoted
// "per <unit>" — sellers of fabric pick "yard" / "meter", sellers of pre-made
// clothing leave the default "piece". The cart UI multiplies quantity × price
// using the stored unit; the API enforces step rules so e.g. you can't buy
// 1.7 packs of buttons.

export type ProductUnit =
  | "piece"
  | "yard"
  | "meter"
  | "foot"
  | "pack"
  | "set"
  | "bundle"
  | "kilogram"
  | "liter";

export const PRODUCT_UNITS: ProductUnit[] = [
  "piece",
  "yard",
  "meter",
  "foot",
  "pack",
  "set",
  "bundle",
  "kilogram",
  "liter",
];

export function isValidUnit(value: string | null | undefined): value is ProductUnit {
  return !!value && (PRODUCT_UNITS as readonly string[]).includes(value);
}

// Per-unit step + label config drives the cart stepper and the per-unit
// validator on the API. Measurement units (yard/meter/foot/kg/L) accept
// half-step quantities; countable units (piece/pack/set/bundle) stay integer.
export type UnitConfig = {
  step: number;          // smallest legal increment
  shortLabel: string;    // for cart pills ("3 yds")
  longLabel: string;     // for product detail ("per yard")
  pluralLong: string;    // ("yards")
};

export const UNIT_CONFIG: Record<ProductUnit, UnitConfig> = {
  piece:    { step: 1,   shortLabel: "pc",  longLabel: "piece",     pluralLong: "pieces" },
  yard:     { step: 0.5, shortLabel: "yd",  longLabel: "yard",      pluralLong: "yards" },
  meter:    { step: 0.5, shortLabel: "m",   longLabel: "meter",     pluralLong: "meters" },
  foot:     { step: 0.5, shortLabel: "ft",  longLabel: "foot",      pluralLong: "feet" },
  pack:     { step: 1,   shortLabel: "pk",  longLabel: "pack",      pluralLong: "packs" },
  set:      { step: 1,   shortLabel: "set", longLabel: "set",       pluralLong: "sets" },
  bundle:   { step: 1,   shortLabel: "bd",  longLabel: "bundle",    pluralLong: "bundles" },
  kilogram: { step: 0.5, shortLabel: "kg",  longLabel: "kilogram",  pluralLong: "kilograms" },
  liter:    { step: 0.5, shortLabel: "L",   longLabel: "liter",     pluralLong: "liters" },
};

export function unitConfig(unit: string): UnitConfig {
  return UNIT_CONFIG[isValidUnit(unit) ? unit : "piece"];
}

// "per yard" / "per piece" — used in product detail price labels.
export function perUnitLabel(unit: string): string {
  return `per ${unitConfig(unit).longLabel}`;
}

// "2.5 yards" / "1 piece" / "3 packs" — pretty-print a quantity with its unit.
export function formatQuantity(quantity: number, unit: string): string {
  const c = unitConfig(unit);
  const isInteger = Number.isInteger(quantity);
  const display = isInteger ? quantity.toString() : quantity.toFixed(2).replace(/\.?0+$/, "");
  const label = quantity === 1 ? c.longLabel : c.pluralLong;
  return `${display} ${label}`;
}

// Validate a quantity against its unit's step rule. Returns null if OK,
// otherwise the human-readable error message.
export function validateQuantity(quantity: number, unit: string): string | null {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return "Quantity must be a positive number.";
  }
  const c = unitConfig(unit);
  // Tolerate floating-point noise: 0.5 + 0.5 + 0.5 = 1.5 exactly, but more
  // exotic chains can drift. Allow a 1e-6 slack on the step check.
  const ratio = quantity / c.step;
  if (Math.abs(ratio - Math.round(ratio)) > 1e-6) {
    return `Quantity for "${c.longLabel}" must be in steps of ${c.step}.`;
  }
  return null;
}
