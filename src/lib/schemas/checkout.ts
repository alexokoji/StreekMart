import { z } from "zod";

export const CheckoutBodySchema = z.object({
  shippingAddress: z.string().min(5).max(500),
  notes: z.string().max(500).optional(),
  paymentMethod: z.enum(["DIRECT", "ON_DELIVERY"]).default("DIRECT"),
  zoneOverride: z.enum(["WITHIN_CITY", "OUTSIDE_CITY"]).optional(),
  shippingChoices: z
    .array(
      z.object({
        sellerId: z.string(),
        provider: z.enum(["SHIPBUBBLE", "KWIK"]).default("SHIPBUBBLE"),
        courierId: z.string().optional(),
        courierName: z.string().optional(),
        priceCents: z.number().int().nonnegative().optional(),
        estimatedDays: z.number().int().optional(),
      }),
    )
    .optional(),
});
