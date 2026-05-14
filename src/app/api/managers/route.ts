import { NextResponse } from "next/server";
import { z } from "zod";
import { Permission } from "@/lib/enums";
import { prisma } from "@/lib/db";
import { requireApiUser, hashPassword } from "@/lib/auth";
import { PERMISSION_KEYS, type PermissionKey } from "@/lib/managers";

// GET /api/managers — list managers attached to the calling user.
// POST /api/managers — create a new manager User account + the link.
//
// The "create + link" pattern means owners hand their manager a fresh login
// (email + password) instead of inviting an existing StreekMart account. That's
// closer to how a real shop would onboard a part-timer: the owner sets up
// the credentials and shares them. Manager users get a Buyer-only account
// (no isSeller/isDesigner) but inherit owner-scoped capabilities through
// the Manager join row.

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
  permissions: z.array(z.enum(PERMISSION_KEYS as readonly [PermissionKey, ...PermissionKey[]])),
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

  // Email must be unique across the whole platform — manager accounts are
  // real Users, not a parallel namespace.
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 },
    );
  }

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
        permissionsJson: JSON.stringify(parsed.data.permissions),
      },
    });
    return { manager, link };
  });

  return NextResponse.json({
    manager: result.manager,
    permissions: parsed.data.permissions,
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
