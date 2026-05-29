import { NextResponse } from "next/server";

// Sink for errors caught by app/error.tsx and app/global-error.tsx.
// We can't open Web Inspector on a stranger's iPhone, so the boundaries
// POST the error here and we read it from the deploy logs.
//
// Format on stdout: `[client-error] <where> | <message> | <ua> | <url>`
// — grep `[client-error]` to find a specific report.

export async function POST(req: Request) {
  let payload: Record<string, unknown> = {};
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    // No body / not JSON — log what we can and move on.
  }

  const where = String(payload.where ?? "unknown");
  const message = String(payload.message ?? "").slice(0, 500);
  const digest = payload.digest ? String(payload.digest) : "";
  const ua = String(payload.ua ?? "").slice(0, 300);
  const url = String(payload.url ?? "").slice(0, 300);
  const stack = payload.stack ? String(payload.stack).slice(0, 4000) : "";

  console.error(
    `[client-error] ${where} | ${message}${digest ? ` (digest ${digest})` : ""} | ${ua} | ${url}`,
  );
  if (stack) console.error(`[client-error] stack:\n${stack}`);

  // 204 — boundary doesn't read the response, and we don't want browsers
  // to retry on a non-2xx if they implement that behavior for keepalive.
  return new NextResponse(null, { status: 204 });
}
