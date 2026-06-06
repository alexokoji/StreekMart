import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAiEnabled } from "@/lib/ai";
import {
  isWhatsAppEnabled,
  sendWhatsAppText,
  verifyWebhookSignature,
} from "@/lib/whatsapp";
import { runConcierge, type ConciergeProductCard } from "@/lib/conciergeCore";

// /api/whatsapp/webhook
//
// GET  — Meta's one-time verification handshake. Returns hub.challenge
//        when the verify token matches.
// POST — incoming message delivery. Meta retries on non-2xx so we always
//        return 200 quickly and do real work async.

export const runtime = "nodejs";

const HISTORY_LIMIT = 12;
const MAX_REPLY_PRODUCTS = 4;

function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

// ── GET: verification handshake ────────────────────────────────────────────
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token && verifyToken && token === verifyToken) {
    return new NextResponse(challenge ?? "", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }
  return new NextResponse("forbidden", { status: 403 });
}

// ── POST: incoming message ────────────────────────────────────────────────
export async function POST(req: Request) {
  // Read raw body so we can verify the HMAC signature; once parsed via
  // .json() the original bytes are lost.
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256");
  if (!verifyWebhookSignature(raw, sig)) {
    console.warn("[whatsapp:webhook] invalid signature");
    // Meta retries on non-2xx — we still return 200 so a misconfigured
    // signature header doesn't trap the queue. Real prod hardening: 401
    // here after you confirm WHATSAPP_APP_SECRET is set everywhere.
    return NextResponse.json({ ok: true, ignored: "invalid signature" });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(raw) as WebhookPayload;
  } catch {
    return NextResponse.json({ ok: true, ignored: "invalid json" });
  }

  // The Meta payload nests messages a few levels deep. Walk every change
  // entry — usually one, sometimes more on busy phones.
  const messages: InboundMessage[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const m of change.value?.messages ?? []) {
        messages.push(m);
      }
    }
  }

  // Fire-and-forget handling so we ACK Meta in <100 ms — Meta retries
  // aggressively on slow webhooks. Any error inside lands in the logs.
  for (const m of messages) {
    void handleInbound(m).catch((err) =>
      console.error("[whatsapp:webhook] handler threw", { err }),
    );
  }

  return NextResponse.json({ ok: true });
}

async function handleInbound(message: InboundMessage): Promise<void> {
  if (!message.from) return;
  const phone = `+${message.from}`; // normalise to E.164 with leading +
  const externalId = message.id;

  // Persist the inbound row first so even a failing AI call shows up in
  // the conversation history. ON_CONFLICT (unique externalId) means a
  // retried delivery is a no-op.
  let inboundBody = "";
  if (message.type === "text") {
    inboundBody = message.text?.body ?? "";
  } else {
    // Non-text (image, audio, document, etc.) — we don't process media
    // in V1 but still record the event so the history is honest.
    inboundBody = `(unsupported message type: ${message.type})`;
  }
  if (externalId) {
    try {
      await prisma.whatsAppMessage.upsert({
        where: { externalId },
        create: {
          phone,
          direction: "IN",
          body: inboundBody,
          externalId,
          userId: await findUserByPhone(phone),
        },
        update: {}, // no-op on retry
      });
    } catch (err) {
      console.warn("[whatsapp:webhook] inbound persist failed", { err });
    }
  }

  // If AI / WhatsApp isn't configured, send a soft fallback so the buyer
  // doesn't sit waiting for nothing.
  if (!isAiEnabled() || !isWhatsAppEnabled()) {
    await sendWhatsAppText({
      to: message.from,
      body: "Hey! StreekMart's concierge isn't on right now — try browsing https://streekmart.online while we get this fixed.",
    });
    return;
  }

  if (message.type !== "text" || !inboundBody.trim()) {
    await sendWhatsAppText({
      to: message.from,
      body: "I can only read text messages right now — describe what you're looking for in a few words and I'll find pieces for you.",
    });
    return;
  }

  // Build the running conversation history for this phone — pull the most
  // recent N messages in BOTH directions so the AI has context. We
  // intentionally cap at HISTORY_LIMIT — Claude reads them all on every
  // turn, so unbounded growth would blow context + cost.
  const recent = await prisma.whatsAppMessage.findMany({
    where: { phone },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: { direction: true, body: true },
  });
  const history = recent.reverse().map((m) => ({
    role: (m.direction === "IN" ? "user" : "assistant") as "user" | "assistant",
    content: m.body,
  }));

  // Run the same concierge brain the on-site SmartSearch uses.
  let result: { reply: string; products: ConciergeProductCard[] };
  try {
    result = await runConcierge({
      messages: history.length > 0 ? history : [{ role: "user", content: inboundBody }],
      // Absolute URLs so WhatsApp's link-preview kicks in cleanly.
      productHref: (id) => `${siteOrigin()}/products/${id}`,
    });
  } catch (err) {
    console.error("[whatsapp:webhook] concierge threw", { err });
    await sendWhatsAppText({
      to: message.from,
      body: "I hit a snag finding pieces just now. Try again in a minute or browse https://streekmart.online directly.",
    });
    return;
  }

  // Compose the WhatsApp reply. Claude's text first, then up to N product
  // links. WhatsApp auto-fetches each URL's OpenGraph image + title, so
  // the buyer sees product cards inline without us sending media.
  const productList = result.products.slice(0, MAX_REPLY_PRODUCTS);
  const productLines = productList
    .map((p) => `• ${p.name} — ${p.href}`)
    .join("\n");
  const replyBody = productLines
    ? `${result.reply}\n\n${productLines}`
    : result.reply;

  const send = await sendWhatsAppText({ to: message.from, body: replyBody });
  if (send.ok && send.externalId) {
    try {
      await prisma.whatsAppMessage.create({
        data: {
          phone,
          direction: "OUT",
          body: replyBody,
          externalId: send.externalId,
          userId: await findUserByPhone(phone),
          // Intent tag — useful when querying "how many recommendation
          // turns has the bot completed today".
          intent: productList.length > 0 ? "recommendation" : "chat",
        },
      });
    } catch (err) {
      console.warn("[whatsapp:webhook] outbound persist failed", { err });
    }
  }
}

async function findUserByPhone(phone: string): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: { phone },
    select: { id: true },
  });
  return user?.id ?? null;
}

// ── Inbound payload types (loose — Meta documents this at
// https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples) ──

type WebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: InboundMessage[];
      };
    }>;
  }>;
};

type InboundMessage = {
  id?: string;
  from?: string;
  type: string;
  text?: { body?: string };
};
