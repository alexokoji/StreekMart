import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { notifyAdmins } from "@/lib/adminNotifications";

// POST /api/account/deletion-request
//
// Self-serve deletion the user triggers from /data-deletion. Requires the
// user to be signed in AND to retype their email exactly — same guard the
// admin's "Remove user" button uses, to make a mis-tap impossible.
//
// On success:
//   - The User row is deleted; every related row cascades automatically
//     (every relation that touches User uses onDelete: Cascade).
//   - The session cookie is cleared so the next request is unauthenticated.
//   - Admins get an audit notification — "X deleted their own account" —
//     so we know it happened without surprising support.
//
// Things we keep (legal / financial retention): nothing right now — the
// User row is the root and cascades delete every related child. If we
// ever need to retain order rows for tax compliance, the cleanest fix is
// to detach the userId on Order rather than delete the User; not needed
// yet.

const Body = z.object({
  // The user retypes their email to confirm. We compare against the
  // session's stored email (case-insensitive).
  confirmEmail: z.string().email(),
});

const SESSION_COOKIE = "upclo_session";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Type your email exactly to confirm." },
      { status: 400 },
    );
  }

  const me = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, name: true, isAdmin: true },
  });
  if (!me) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }
  // Admins can't self-delete through this path. Removing the platform's
  // own admin row would lock everyone out of /admin until a DB op
  // restores it — too risky for a one-button flow.
  if (me.isAdmin) {
    return NextResponse.json(
      {
        error:
          "Admin accounts can't be deleted from here. Email support@streekmart.com for offline help.",
      },
      { status: 403 },
    );
  }

  if (
    me.email.trim().toLowerCase() !== parsed.data.confirmEmail.trim().toLowerCase()
  ) {
    return NextResponse.json(
      { error: "That email doesn't match the one on your account." },
      { status: 400 },
    );
  }

  // Fire the admin notification BEFORE deleting so the cascade doesn't
  // wipe the userId we'd want to reference. notifyAdmins itself is
  // fire-and-forget; we don't `await` it because Resend can be slow.
  void notifyAdmins({
    kind: "Account deletion",
    summary: `${me.name} (${me.email}) deleted their own account.`,
    link: "/admin/users",
    meta: [
      { label: "Name", value: me.name },
      { label: "Email", value: me.email },
      {
        label: "Triggered",
        value: new Date().toISOString(),
      },
    ],
  });

  // Cascade through every related row. Onnshort circuits: if this throws
  // we surface the error to the user — partial deletion is worse than no
  // deletion (it leaves orphans).
  try {
    await prisma.user.delete({ where: { id: me.id } });
  } catch (err) {
    console.error("[deletion-request] cascade delete failed", {
      userId: me.id,
      err,
    });
    return NextResponse.json(
      {
        error:
          "We couldn't complete the deletion automatically. Email support@streekmart.com and we'll process it manually.",
      },
      { status: 500 },
    );
  }

  // Clear the session cookie so the redirect lands as an unauthenticated
  // request. We use the same name + path the auth helpers use so the
  // browser actually drops it.
  cookies().delete(SESSION_COOKIE);

  return NextResponse.json({ ok: true });
}
