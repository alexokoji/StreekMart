import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { getLogisticsService } from "@/lib/services/logistics";

const Body = z.object({
  provider: z.enum(["SENDBOX", "JUMIA", "DELLYMAN"]).default("SENDBOX"),
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
    const me = await prisma.user.findUnique({
      where: { id: guard.session.sub },
      select: { country: true, city: true, region: true },
    });

    if (!me?.country || !me.city) {
      return NextResponse.json(
        { error: "Your location is not set. Update it in Account settings." },
        { status: 400 },
      );
    }

    const logistics = getLogisticsService();
    const rates = await logistics.getShippingRates({
      provider: parsed.data.provider as any,
      pickupAddress: "Seller Location", // Placeholder — seller address comes from seller.location
      pickupCity: parsed.data.pickupCity,
      pickupState: parsed.data.pickupState,
      pickupPostalCode: parsed.data.pickupPostalCode,
      pickupCountry: parsed.data.pickupCountry,
      deliveryAddress: me.city, // Placeholder
      deliveryCity: parsed.data.deliveryCity,
      deliveryState: parsed.data.deliveryState,
      deliveryPostalCode: parsed.data.deliveryPostalCode,
      deliveryCountry: parsed.data.deliveryCountry,
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
