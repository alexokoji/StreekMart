import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { getLogisticsService } from "@/lib/services/logistics";

const Body = z.object({
  provider: z.enum(["SENDBOX", "JUMIA", "DELLYMAN"]).default("SENDBOX"),
  sellerId: z.string().optional(),
  pickupCity: z.string(),
  pickupState: z.string().optional(),
  pickupPostalCode: z.string().optional(),
  pickupCountry: z.string(),
  deliveryCity: z.string(),
  deliveryState: z.string().optional(),
  deliveryPostalCode: z.string().optional(),
  deliveryCountry: z.string(),
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

    // Fetch seller phone if sellerId provided
    let sellerPhone = "+234000000000";
    if (parsed.data.sellerId) {
      const seller = await prisma.user.findUnique({
        where: { id: parsed.data.sellerId },
        select: { phone: true },
      });
      if (seller?.phone) {
        sellerPhone = seller.phone;
      }
    }

    console.log("User location from DB:", {
      country: me.country,
      city: me.city,
      region: me.region,
    });

    // Ensure delivery (buyer) location has all required fields
    const deliveryCity = parsed.data.deliveryCity || me.city;
    const deliveryState = parsed.data.deliveryState || me.region || "";
    const deliveryCountry = parsed.data.deliveryCountry || me.country || "NG";
    const pickupCity = parsed.data.pickupCity;
    const pickupState = parsed.data.pickupState || "";
    const pickupCountry = parsed.data.pickupCountry || "NG";

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

    const logistics = getLogisticsService();
    const rates = await logistics.getShippingRates({
      provider: parsed.data.provider as any,
      pickupAddress: "Seller Location", // Placeholder — seller address comes from seller.location
      pickupCity,
      pickupState,
      pickupPostalCode: parsed.data.pickupPostalCode,
      pickupCountry,
      pickupPhone: sellerPhone,
      deliveryAddress: deliveryCity, // Placeholder
      deliveryCity,
      deliveryState,
      deliveryPostalCode: parsed.data.deliveryPostalCode,
      deliveryCountry,
      deliveryPhone: me.phone || "+234000000000",
      weight: parsed.data.weight,
      description: parsed.data.description,
    });

    // Providers may return either an array of courier options or an object
    // with a `couriers` array. Be permissive so both shapes work.
    if (Array.isArray(rates)) {
      return NextResponse.json({ ok: true, provider: parsed.data.provider, rates });
    }

    return NextResponse.json({
      ok: true,
      provider: parsed.data.provider,
      rates: (rates && (rates as any).couriers) || [],
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : "";
    
    // Log full error for debugging
    console.error("Shipping rates error:", {
      message: errorMsg,
      stack: errorStack,
      sendboxLive: process.env.SENDBOX_LIVE,
      sendboxApiKeySet: !!process.env.SENDBOX_API_KEY,
      sendboxBaseUrl: process.env.SENDBOX_BASE_URL,
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
