import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import { isValidCountryCode } from "@/lib/location";

// GET    /api/admin/delivery-cities                — list all cities (active + inactive)
// POST   /api/admin/delivery-cities                — add a city
// PATCH  /api/admin/delivery-cities/[id]           — edit fee / active flag
// DELETE /api/admin/delivery-cities/[id]           — hard delete
//
// A row here whitelists a (country, city) pair for in-house platform
// delivery. Checkout reads it via resolveDeliveryQuote in lib/location.ts.

const CreateBody = z.object({
  country: z.string().length(2),
  name: z.string().min(2).max(80),
  region: z.string().max(80).optional(),
  feeCents: z.number().int().min(0).max(1_000_000),
  active: z.boolean().optional().default(true),
});

export async function GET() {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_DELIVERY);
  if ("error" in guard) return guard.error;
  const cities = await prisma.deliveryCity.findMany({
    orderBy: [{ active: "desc" }, { country: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ cities });
}

export async function POST(req: Request) {
  const guard = await requireApiAdmin(ADMIN_PERMISSIONS.MANAGE_DELIVERY);
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const code = parsed.data.country.toUpperCase();
  if (!isValidCountryCode(code)) {
    return NextResponse.json({ error: "Country code isn't supported." }, { status: 400 });
  }

  try {
    const city = await prisma.deliveryCity.create({
      data: {
        country: code,
        name: parsed.data.name.trim(),
        region: parsed.data.region?.trim() || null,
        feeCents: parsed.data.feeCents,
        active: parsed.data.active ?? true,
      },
    });
    return NextResponse.json({ city });
  } catch (err) {
    // Unique constraint = (country, name) duplicate.
    return NextResponse.json(
      { error: "That city is already on the list." },
      { status: 409 },
    );
  }
}
