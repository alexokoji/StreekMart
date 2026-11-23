import { z } from "zod";

export const SupplierBody = z.object({
  name: z.string().trim().min(1).max(80),
  integration: z.enum(["MANUAL", "API"]).default("MANUAL"),
  apiBaseUrl: z.string().trim().url().max(300).nullable().optional(),
  // Empty string / undefined on update = keep the stored key.
  apiKey: z.string().trim().max(300).optional(),
  // Raw ApiConfig object; validated with validateApiConfig in the route.
  apiConfig: z.record(z.any()).optional(),
  contactName: z.string().trim().max(80).nullable().optional(),
  contactEmail: z.string().trim().max(120).nullable().optional(),
  contactPhone: z.string().trim().max(40).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  markupType: z.enum(["PERCENT", "FIXED"]).default("PERCENT"),
  markupValue: z.number().min(0).max(1_000_000).default(25),
  active: z.boolean().optional(),
});

export function slugifyName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "supplier";
}

