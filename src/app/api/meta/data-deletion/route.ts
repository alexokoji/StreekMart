import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { verifySignedRequest } from "@/lib/metaSignedRequest";

// POST /api/meta/data-deletion
//
// THIS is the "Data Deletion Callback URL" you paste into Meta's app
// dashboard. Meta posts here whenever a Facebook / WhatsApp user requests
// deletion of their data; we delete what we have on file for them and
// return the JSON envelope Meta expects:
//
//   {
//     "url": "https://streekmart.com/data-deletion/<code>",
//     "confirmation_code": "<code>"
//   }
//
// The user can then visit that URL to confirm their request was processed.
//
// We intentionally always return 200 (even on signature failure) with the
// envelope Meta wants — Meta retries hard on non-2xx and a misconfigured
// signature would otherwise spam our logs. The audit row is tagged
// FAILED + reason so prod incidents are traceable.

export const runtime = "nodejs";

function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function newConfirmationCode(): string {
  // 16 bytes hex → 32 chars. Easy to read in URLs, plenty of entropy.
  return randomBytes(16).toString("hex");
}

export async function POST(req: Request) {
  // Meta sends `signed_request=<...>` as application/x-www-form-urlencoded.
  const ct = req.headers.get("content-type") ?? "";
  let signedRequest = "";
  try {
    if (ct.includes("application/x-www-form-urlencoded")) {
      const form = await req.formData();
      signedRequest = String(form.get("signed_request") ?? "");
    } else if (ct.includes("application/json")) {
      // Some test rigs send JSON — accept both.
      const body = (await req.json().catch(() => null)) as
        | { signed_request?: string }
        | null;
      signedRequest = body?.signed_request ?? "";
    } else {
      // Last resort — try formData anyway; Meta is the source of truth and
      // it always uses the form encoding.
      const form = await req.formData().catch(() => null);
      signedRequest = form ? String(form.get("signed_request") ?? "") : "";
    }
  } catch {
    signedRequest = "";
  }

  const code = newConfirmationCode();

  // Verify + parse the envelope.
  const verified = verifySignedRequest(signedRequest);
  if (!verified.ok) {
    // Record the failed request so we can audit / investigate.
    await prisma.dataDeletionRequest
      .create({
        data: {
          confirmationCode: code,
          metaUserId: "(verification failed)",
          status: "FAILED",
          notes: verified.error,
        },
      })
      .catch(() => {});
    return NextResponse.json({
      url: `${siteOrigin()}/data-deletion/${code}`,
      confirmation_code: code,
    });
  }

  const metaUserId = verified.payload.user_id;

  // Try to resolve the Meta user_id to a phone we've stored. Meta's
  // payload doesn't include the phone number directly, so we widen the
  // match to: any WhatsAppMessage row where `phone` contains the
  // metaUserId tail digits (a common WhatsApp ID is just the phone
  // without the leading `+`). If nothing matches we still record the
  // request — the user has the right to a confirmation even when we had
  // no data on them.
  const candidate = `+${metaUserId.replace(/^\+/, "")}`;
  const matches = await prisma.whatsAppMessage.findMany({
    where: {
      OR: [
        { phone: candidate },
        { phone: { contains: metaUserId } },
      ],
    },
    select: { id: true, phone: true },
  });
  const phoneSet = new Set(matches.map((m) => m.phone));

  let deletedCount = 0;
  if (matches.length > 0) {
    // Delete every row that touched any of the matched phones — we want
    // the full conversation gone, not just rows in one direction.
    const res = await prisma.whatsAppMessage.deleteMany({
      where: { phone: { in: Array.from(phoneSet) } },
    });
    deletedCount = res.count;
  }

  await prisma.dataDeletionRequest.create({
    data: {
      confirmationCode: code,
      metaUserId,
      phone: phoneSet.size === 1 ? Array.from(phoneSet)[0] : null,
      status: "COMPLETED",
      deletedCount,
      notes:
        deletedCount > 0
          ? `Removed ${deletedCount} WhatsApp message rows.`
          : "No matching data on file for this user.",
      completedAt: new Date(),
    },
  });

  return NextResponse.json({
    url: `${siteOrigin()}/data-deletion/${code}`,
    confirmation_code: code,
  });
}
