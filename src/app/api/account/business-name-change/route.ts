import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  canonicaliseBusinessNameDisplay,
  normaliseBusinessName,
} from "@/lib/businessName";
import { isBusinessNameTaken } from "@/lib/businessNameServer";
import { notifyAdmins } from "@/lib/adminNotifications";

// POST /api/account/business-name-change { requestedName, note? }
//
// User flow when a business name is already set. The user can't edit
// `User.businessName` directly — the settings PATCH refuses with a 403 —
// so they submit here, and an admin approves/rejects from
// /admin/business-names. Approval is what actually writes the new value
// onto User.

const Body = z.object({
  requestedName: z.string().min(2).max(80),
  note: z.string().max(400).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const display = canonicaliseBusinessNameDisplay(parsed.data.requestedName);
  if (!display) {
    return NextResponse.json({ error: "Enter a valid business name." }, { status: 400 });
  }
  const lower = normaliseBusinessName(display);

  // Block duplicate live submissions — one in-flight per user keeps the
  // admin queue clean and stops accidental double-submits.
  const existingPending = await prisma.businessNameChangeRequest.findFirst({
    where: { userId: session.sub, status: "PENDING" },
    select: { id: true },
  });
  if (existingPending) {
    return NextResponse.json(
      { error: "You already have a pending business name change request." },
      { status: 409 },
    );
  }

  // Check uniqueness against existing User rows, ignoring the requester's
  // own current value so they can resubmit case variants if they want.
  if (await isBusinessNameTaken(lower, session.sub)) {
    return NextResponse.json(
      { error: "That business name is already taken." },
      { status: 409 },
    );
  }

  const me = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { name: true, email: true, businessName: true },
  });

  const created = await prisma.businessNameChangeRequest.create({
    data: {
      userId: session.sub,
      currentName: me?.businessName ?? null,
      requestedName: display,
      requestedLower: lower,
      decisionNote: parsed.data.note,
      status: "PENDING",
    },
  });

  // Ping every admin. Same fire-and-forget pattern as the verification
  // queue — submission has already landed.
  void notifyAdmins({
    kind: "Business name change",
    summary: `${me?.name ?? "A user"} wants "${display}"`,
    link: "/admin/business-names",
    meta: [
      { label: "Requester", value: `${me?.name ?? "—"} · ${me?.email ?? ""}` },
      { label: "Current name", value: me?.businessName ?? "(none)" },
      { label: "Requested name", value: display },
    ],
  });

  return NextResponse.json({ ok: true, request: created });
}
