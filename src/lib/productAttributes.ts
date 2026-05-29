// Product attribute groups — the seller-defined "Color / Size / Finish"
// pickers that buyers choose from at add-to-cart time. The same selection
// flows through to the Order so the seller knows what to ship.
//
// Schema: an array of AttributeGroup objects on Product.attributesJson.
// Buyer's pick is a plain `{ groupName: chosenOption }` object on
// CartItem.selectedAttributesJson and Order.selectedAttributesJson.
//
// We use plain string maps rather than option-IDs because:
//   - Option lists change rarely and the strings are stable enough.
//   - Display is just the string — no extra lookup at render time.
//   - Sellers describe options in their own language and can edit them
//     without breaking historical orders (the chosen string is frozen on
//     the order row).

import { z } from "zod";

// Hard limits — keeps the editor sane and prevents a malicious / careless
// seller from saving a 10k-option list that breaks the picker.
export const MAX_GROUPS = 4;
export const MAX_OPTIONS_PER_GROUP = 20;
export const MAX_NAME_LEN = 40;
export const MAX_OPTION_LEN = 40;

export type AttributeGroup = {
  name: string;
  options: string[];
  required: boolean;
};

export type AttributeSelection = Record<string, string>;

// Zod schemas — used by the product create/update API and the cart-add API.
// `transform` trims and dedupes so the seller can paste sloppy lists and
// still end up with a clean spec.
export const AttributeGroupSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LEN),
  options: z
    .array(z.string().trim().min(1).max(MAX_OPTION_LEN))
    .min(1)
    .max(MAX_OPTIONS_PER_GROUP)
    .transform((opts) => {
      // De-dupe case-insensitively but preserve the first-seen casing.
      const seen = new Set<string>();
      const out: string[] = [];
      for (const o of opts) {
        const key = o.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(o);
      }
      return out;
    })
    .refine((opts) => opts.length > 0, "Each group needs at least one option."),
  required: z.boolean().default(true),
});

export const AttributesSchema = z
  .array(AttributeGroupSchema)
  .max(MAX_GROUPS)
  .transform((groups) => {
    // De-dupe group names case-insensitively too.
    const seen = new Set<string>();
    const out: AttributeGroup[] = [];
    for (const g of groups) {
      const key = g.name.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(g);
    }
    return out;
  });

export const SelectionSchema = z.record(z.string().min(1).max(MAX_OPTION_LEN));

/**
 * Parse a Product.attributesJson string into typed groups. Returns an empty
 * array on any parse failure (legacy products, manual DB edits, etc.) so
 * the caller can treat "no attributes" and "broken JSON" the same way.
 */
export function parseProductAttributes(raw: string | null | undefined): AttributeGroup[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    const result = AttributesSchema.safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

/**
 * Parse a CartItem/Order.selectedAttributesJson string into a selection
 * map. Empty object on any parse failure.
 */
export function parseAttributeSelection(raw: string | null | undefined): AttributeSelection {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    const result = SelectionSchema.safeParse(parsed);
    return result.success ? result.data : {};
  } catch {
    return {};
  }
}

/**
 * Validate a buyer's selection against the product's attribute spec.
 * - Every required group must have a non-empty pick.
 * - Picks must be one of the group's defined options (case-insensitive
 *   match; we normalise to the option's canonical casing).
 * - Unknown group names in the selection are dropped silently (they were
 *   probably removed from the spec since the buyer added the item).
 *
 * Returns `{ ok: true, normalized }` on success or `{ ok: false, error }`
 * with a human-readable error string suitable for inlining in the UI or
 * a 400 response.
 */
export function validateAttributeSelection(
  groups: AttributeGroup[],
  rawSelection: unknown,
): { ok: true; normalized: AttributeSelection } | { ok: false; error: string } {
  const sel = SelectionSchema.safeParse(rawSelection ?? {});
  if (!sel.success) {
    return { ok: false, error: "Invalid attribute selection." };
  }
  const incoming = sel.data;
  const normalized: AttributeSelection = {};

  for (const group of groups) {
    const pick = incoming[group.name];
    if (!pick) {
      if (group.required) {
        return { ok: false, error: `Please choose a ${group.name.toLowerCase()}.` };
      }
      continue;
    }
    const canonical = group.options.find(
      (o) => o.toLowerCase() === pick.trim().toLowerCase(),
    );
    if (!canonical) {
      return {
        ok: false,
        error: `"${pick}" isn't one of the available options for ${group.name}.`,
      };
    }
    normalized[group.name] = canonical;
  }

  return { ok: true, normalized };
}

/**
 * Render a selection as a short human-readable summary, e.g.
 * `Color: Blue · Size: M`. Empty input renders as empty string so the
 * caller can `{summary && <p>{summary}</p>}` without a guard.
 */
export function formatAttributeSelection(selection: AttributeSelection): string {
  const parts = Object.entries(selection)
    .filter(([, v]) => v && v.trim().length > 0)
    .map(([k, v]) => `${k}: ${v}`);
  return parts.join(" · ");
}
