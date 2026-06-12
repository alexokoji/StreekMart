import { z } from "zod";

export const CheckoutBodySchema = z.object({
  shippingAddress: z.string().min(5).max(500),
  // Structured fields from the Google Places picker. Optional so legacy
  // free-text submissions still validate.
  shippingFormattedAddress: z.string().max(500).optional(),
  shippingLatitude: z.number().min(-90).max(90).optional(),
  shippingLongitude: z.number().min(-180).max(180).optional(),
  shippingPlaceId: z.string().max(255).optional(),
  notes: z.string().max(500).optional(),
  paymentMethod: z.enum(["DIRECT", "ON_DELIVERY"]).default("DIRECT"),
  // Optional promo code applied at checkout. Validated server-side via
  // /api/promo-codes/validate logic before being recorded.
  promoCode: z.string().trim().toUpperCase().max(40).optional(),
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
