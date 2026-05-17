import { NextResponse } from "next/server";
import { z } from "zod";
import { Permission } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser, hashPassword } from "@/lib/auth";
import { PERMISSION_KEYS, type PermissionKey } from "@/lib/managers";

// GET /api/managers — list managers attached to the calling user.
// POST /api/managers — create a new manager User account + the link.
//
// `role` = "manager" (default) | "rider".
//
//   - role="manager" works as before. Owner picks the permission keys to
//     grant. Examples: a shop assistant with `edit_products`+`manage_orders`.
//
//   - role="rider" is the new delivery-rider flow:
//       * Only verified sellers / designers can create them — the gate keeps
//         random accounts from spinning up fake fleets.
//       * Permissions are forced to ["manage_deliveries"] regardless of what
//         the client sends. Riders shouldn't have shop-management access.
//       * Optional `phone` is stored on the Manager row for buyer contact.
//
// In both cases the manager gets a real User account (buyer-only) plus a
// Manager link to the owner. Login URL: /login as normal; riders land on
// /rider, regular managers on /account.

export async function GET() {
  const guard = await requireApiUser([Permission.SELLER, Permission.DESIGNER]);
  if ("error" in guard) return guard.error;

  const rows = await prisma.manager.findMany({
    where: { ownerId: guard.session.sub },
    include: {
      manager: { select: { id: true, name: true, email: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    managers: rows.map((r) => ({
      id: r.id,
      role: r.role,
      phone: r.phone,
      manager: r.manager,
      permissions: safeParseKeys(r.permissionsJson),
      createdAt: r.createdAt,
    })),
  });
}

const CreateBody = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  role: z.enum(["manager", "rider"]).default("manager"),
  phone: z.string().max(40).optional(),
  permissions: z
    .array(z.enum(PERMISSION_KEYS as readonly [PermissionKey, ...PermissionKey[]]))
    .default([]),
});

export async function POST(req: Request) {
  const guard = await requireApiUser([Permission.SELLER, Permission.DESIGNER]);
  if ("error" in guard) return guard.error;

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  // Rider creation is gated on verification — only sellers / designers with
  // an approved badge can spin up delivery accounts. This keeps the trust
  // chain end-to-end: a buyer ordering from a verified shop knows the rider
  // belongs to a verified outfit.
  if (parsed.data.role === "rider") {
    const owner = await prisma.user.findUnique({
      where: { id: guard.session.sub },
      select: { sellerVerified: true, designerVerified: true },
    });
    if (!owner?.sellerVerified && !owner?.designerVerified) {
      return NextResponse.json(
        {
          error:
            "Only verified sellers or designers can create delivery rider accounts. Submit a verification request first.",
        },
        { status: 403 },
      );
    }
  }

  // Email must be unique across the whole platform — manager accounts are
  // real Users, not a parallel namespace.
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 },
    );
  }

  // Force the rider permission set; ignore whatever the client sent. For
  // regular managers, use the client-supplied permissions.
  const finalPermissions: PermissionKey[] =
    parsed.data.role === "rider" ? ["manage_deliveries"] : parsed.data.permissions;

  const passwordHash = await hashPassword(parsed.data.password);
  const result = await prisma.$transaction(async (tx) => {
    const manager = await tx.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash,
        // Buyer permission is implicit; managers don't get seller/designer
        // flags of their own. Their power comes from the Manager link below.
        cart: { create: {} },
      },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    const link = await tx.manager.create({
      data: {
        ownerId: guard.session.sub,
        managerId: manager.id,
        role: parsed.data.role,
        phone: parsed.data.phone ?? null,
        permissionsJson: JSON.stringify(finalPermissions),
      },
    });
    return { manager, link };
  });

  return NextResponse.json({
    manager: result.manager,
    role: parsed.data.role,
    phone: parsed.data.phone ?? null,
    permissions: finalPermissions,
    linkId: result.link.id,
  });
}

function safeParseKeys(json: string): PermissionKey[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((k): k is PermissionKey =>
      (PERMISSION_KEYS as readonly string[]).includes(k),
    );
  } catch {
    return [];
  }
}
