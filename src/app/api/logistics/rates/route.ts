import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { getLogisticsService } from "@/lib/services/logistics";

// Map Nigerian state codes to full state names (title case) for Sendbox API
const NIGERIAN_STATE_CODES: Record<string, string> = {
  AB: "Abia",
  AD: "Adamawa",
  AK: "Akwa Ibom",
  AN: "Anambra",
  BA: "Bauchi",
  BY: "Bayelsa",
  BE: "Benue",
  BO: "Borno",
  CR: "Cross River",
  DE: "Delta",
  EB: "Ebonyi",
  ED: "Edo",
  EK: "Ekiti",
  EN: "Enugu",
  FC: "FCT",
  GO: "Gombe",
  IM: "Imo",
  JI: "Jigawa",
  KD: "Kaduna",
  KN: "Kano",
  KT: "Katsina",
  KE: "Kebbi",
  KO: "Kogi",
  LA: "Lagos",
  NA: "Nasarawa",
  NI: "Niger",
  OG: "Ogun",
  ON: "Ondo",
  OS: "Osun",
  OY: "Oyo",
  PL: "Plateau",
  RI: "Rivers",
  SO: "Sokoto",
  TA: "Taraba",
  YO: "Yobe",
  ZA: "Zamfara",
};

function expandStateCode(code?: string | null): string {
  if (!code) return "";
  return NIGERIAN_STATE_CODES[code.toUpperCase()] || code;
}

const Body = z.object({
  provider: z.enum(["SHIPBUBBLE", "KWIK"]).default("SHIPBUBBLE"),
  sellerId: z.string().optional(),
  // Pickup fields are optional when sellerId is supplied — the server
  // backfills missing pieces from the seller's User row + default
  // pickup Address. Lets mobile clients that haven't received a cart
  // payload with the seller's city still quote rates.
  pickupCity: z.string().optional().default(""),
  pickupState: z.string().optional(),
  pickupPostalCode: z.string().optional(),
  pickupCountry: z.string().optional().default(""),
  deliveryCity: z.string(),
  deliveryState: z.string().optional(),
  deliveryPostalCode: z.string().optional(),
  deliveryCountry: z.string(),
  // Optional structured delivery address from the Google Places picker. When
  // present we forward it verbatim to Shipbubble — its validator expects
  // exactly this Google-formatted string.
  deliveryFormattedAddress: z.string().max(500).optional(),
  deliveryPlaceId: z.string().max(255).optional(),
  deliveryLatitude: z.number().min(-90).max(90).optional(),
  deliveryLongitude: z.number().min(-180).max(180).optional(),
  weight: z.number().positive().optional(),
  description: z.string().optional(),
});

/**
 * POST /api/logistics/rates
 * Get shipping rate quotes from a logistics provider.
 * Used during checkout to show buyers shipping options.
 */
export async function POST(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    console.log("Rates request received:", {
      provider: parsed.data.provider,
      pickupCity: parsed.data.pickupCity,
      pickupState: parsed.data.pickupState,
      pickupCountry: parsed.data.pickupCountry,
      deliveryCity: parsed.data.deliveryCity,
      deliveryState: parsed.data.deliveryState,
      deliveryCountry: parsed.data.deliveryCountry,
    });

    const me = await prisma.user.findUnique({
      where: { id: guard.session.sub },
      select: { country: true, city: true, region: true, phone: true },
    });

    if (!me?.country || !me.city) {
      return NextResponse.json(
        { error: "Your location is not set. Update it in Account settings." },
        { status: 400 },
      );
    }

    // Fetch seller phone + default pickup address if sellerId provided. The
    // pickup address (when set in seller settings) is a Google-validated street
    // address — using its formattedAddress is what gets Shipbubble to accept
    // the pickup leg.
    let sellerPhone = "+234000000000";
    let sellerPickup: {
      formattedAddress: string;
      placeId?: string;
      latitude?: number;
      longitude?: number;
      phone?: string;
    } | null = null;
    // Seller's own city/state/country, used to backfill any pickup
    // field the caller didn't supply.
    let sellerLocation: { city: string | null; region: string | null; country: string | null } = {
      city: null,
      region: null,
      country: null,
    };
    if (parsed.data.sellerId) {
      const seller = await prisma.user.findUnique({
        where: { id: parsed.data.sellerId },
        select: {
          phone: true,
          city: true,
          region: true,
          country: true,
          addresses: {
            where: { kind: "PICKUP", isDefault: true },
            take: 1,
          },
        },
      });
      if (seller?.phone) sellerPhone = seller.phone;
      sellerLocation = {
        city: seller?.city ?? null,
        region: seller?.region ?? null,
        country: seller?.country ?? null,
      };
      const pickup = seller?.addresses?.[0];
      if (pickup) {
        sellerPickup = {
          formattedAddress: pickup.formattedAddress,
          placeId: pickup.placeId ?? undefined,
          latitude: pickup.latitude ?? undefined,
          longitude: pickup.longitude ?? undefined,
          phone: pickup.phone ?? undefined,
        };
      }
    }

    console.log("User location from DB:", {
      country: me.country,
      city: me.city,
      region: me.region,
    });

    // Ensure delivery (buyer) location has all required fields
    const deliveryCity = parsed.data.deliveryCity || me.city;
    const deliveryState = expandStateCode(parsed.data.deliveryState || me.region);
    const deliveryCountry = parsed.data.deliveryCountry || me.country || "NG";
    // Backfill missing pickup fields from the seller's User record.
    // Clients that don't have the seller's city in their cart payload
    // (e.g. older mobile builds) will send "" — we resolve here.
    const pickupCity = parsed.data.pickupCity || sellerLocation.city || "";
    const pickupState = expandStateCode(parsed.data.pickupState || sellerLocation.region || "");
    const pickupCountry = parsed.data.pickupCountry || sellerLocation.country || "NG";

    console.log("Processed location values:", {
      pickupCity,
      pickupState,
      pickupCountry,
      deliveryCity,
      deliveryState,
      deliveryCountry,
    });

    // Validate that required fields are not empty (Sendbox requires these)
    if (!deliveryCity || !deliveryState || !deliveryCountry) {
      return NextResponse.json(
        { error: "Delivery location is incomplete. City, state, and country are required." },
        { status: 400 },
      );
    }

    if (!pickupCity || !pickupState || !pickupCountry) {
      return NextResponse.json(
        { error: "Pickup location is incomplete. City, state, and country are required." },
        { status: 400 },
      );
    }

    // Shipbubble's address validator (Google Places) rejects vague "City, State"
    // strings. Refuse early when we know the call would fail, with a message
    // that points to the fix instead of bubbling up Shipbubble's raw 400.
    if (parsed.data.provider === "SHIPBUBBLE") {
      if (!sellerPickup?.formattedAddress) {
        return NextResponse.json(
          {
            error:
              "This seller hasn't added a pickup location yet. Ask them to set one in Seller settings before placing the order.",
            code: "SELLER_PICKUP_MISSING",
          },
          { status: 400 },
        );
      }
      if (!parsed.data.deliveryFormattedAddress && !parsed.data.deliveryPlaceId) {
        return NextResponse.json(
          {
            error: "Pick a delivery address from the map to see shipping options.",
            code: "DELIVERY_ADDRESS_REQUIRED",
          },
          { status: 400 },
        );
      }
    }

    const logistics = getLogisticsService();
    const rates = await logistics.getShippingRates({
      pickupAddress: {
        address: sellerPickup?.formattedAddress || `${pickupCity}, ${pickupState}`,
        city: pickupCity,
        state: pickupState,
        country: pickupCountry,
        phone: sellerPickup?.phone || sellerPhone,
        formattedAddress: sellerPickup?.formattedAddress,
        placeId: sellerPickup?.placeId,
        latitude: sellerPickup?.latitude,
        longitude: sellerPickup?.longitude,
      },
      deliveryAddress: {
        address:
          parsed.data.deliveryFormattedAddress || `${deliveryCity}, ${deliveryState}`,
        city: deliveryCity,
        state: deliveryState,
        country: deliveryCountry,
        phone: me.phone || "+234000000000",
        formattedAddress: parsed.data.deliveryFormattedAddress,
        placeId: parsed.data.deliveryPlaceId,
        latitude: parsed.data.deliveryLatitude,
        longitude: parsed.data.deliveryLongitude,
      },
      weight: parsed.data.weight,
      description: parsed.data.description,
    });

    return NextResponse.json({
      ok: true,
      provider: parsed.data.provider,
      rates,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : "";
    
    // Log full error for debugging
    console.error("Shipping rates error:", {
      message: errorMsg,
      stack: errorStack,
      provider: parsed.data.provider,
      shipbubbleEnabled: process.env.SHIPBUBBLE_ENABLED,
      shipbubbleApiKeySet: !!process.env.SHIPBUBBLE_API_KEY,
      shipbubbleBaseUrl: process.env.SHIPBUBBLE_BASE_URL,
      shipbubbleCategoryIdSet: !!process.env.SHIPBUBBLE_DEFAULT_CATEGORY_ID,
    });

    // Return detailed error in dev; generic in prod
    const isProduction = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        error: errorMsg,
        ...(isProduction ? {} : { stack: errorStack }),
      },
      { status: 500 },
    );
  }
}
