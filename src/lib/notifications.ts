// Native push notifications via Expo's hosted push service.
//
// Provider: https://exp.host/--/api/v2/push/send — Expo proxies the request
// to APNs (iOS) and FCM (Android) using the credentials baked into the
// Expo project. No separate FCM/APNs setup is needed.
//
// Stub mode: when there are zero PushTokens for a user we silently no-op
// rather than throw. That mirrors the email layer (sendEmail in lib/email.ts)
// — push is best-effort additional channel; the caller's main success path
// (email, DB write) stays intact even if push fails.

import { prisma } from "./db";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Expo's send endpoint accepts up to 100 messages per request. We chunk
// to stay under the limit; bigger payloads get spread across requests.
const BATCH_SIZE = 100;

export type SendPushArgs = {
  userId: string;
  title: string;
  body: string;
  // Optional deep-link path or URL the mobile shell uses when the user taps
  // the notification. The shell already knows how to convert a path into
  // a WebView nav (see App.tsx / resolveDeepLink).
  link?: string;
  // Optional payload available to the foreground notification handler in
  // the shell, e.g. { type: "new-message", chatId: "..." }.
  data?: Record<string, unknown>;
};

export type SendPushResult = {
  ok: boolean;
  // How many tickets came back accepted vs rejected. ok=true means the
  // request succeeded; individual tickets may still be `status: "error"`.
  accepted: number;
  rejected: number;
};

export async function sendPush(args: SendPushArgs): Promise<SendPushResult> {
  // Persist the notification to the inbox table BEFORE we attempt the push
  // so the bell-icon UI still shows past events even if Expo rejects the
  // ticket. Failures here are logged but never block the send.
  prisma.notification.create({
    data: {
      userId: args.userId,
      type: typeof args.data?.type === "string" ? (args.data!.type as string) : "system",
      title: args.title,
      body: args.body,
      link: args.link ?? null,
      dataJson: args.data ? JSON.stringify(args.data) : null,
    },
  }).catch((err) => console.error("[notification:persist] threw", { userId: args.userId, err }));

  const tokens = await prisma.pushToken.findMany({
    where: { userId: args.userId },
    select: { token: true },
  });
  if (tokens.length === 0) {
    return { ok: true, accepted: 0, rejected: 0 };
  }

  // Build one message envelope per token. Expo merges duplicate sounds /
  // channels automatically; we just keep the user-facing payload minimal.
  const messages = tokens.map((t) => ({
    to: t.token,
    sound: "default" as const,
    title: args.title,
    body: args.body,
    // Channel ID is Android-specific; "default" is the system-supplied one
    // and lets users mute the app without separate channels.
    channelId: "default",
    // Anything we want the shell to react to lives in data. The link is
    // duplicated there so the tap handler in the shell can navigate even
    // without reading the top-level notification fields.
    data: {
      ...(args.data ?? {}),
      ...(args.link ? { link: args.link } : {}),
    },
  }));

  let accepted = 0;
  let rejected = 0;

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const chunk = messages.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Optional Authorization header for higher rate limits — set
          // EXPO_ACCESS_TOKEN in env. Without it we get the unauthenticated
          // tier (still ~600 reqs/min, plenty for this app's volume).
          ...(process.env.EXPO_ACCESS_TOKEN
            ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
            : {}),
        },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        console.error("[push:send] HTTP error", { status: res.status, userId: args.userId });
        rejected += chunk.length;
        continue;
      }
      const payload = (await res.json()) as {
        data?: Array<
          | { status: "ok"; id: string }
          | { status: "error"; message: string; details?: { error?: string } }
        >;
      };
      const tickets = payload.data ?? [];
      // Walk the tickets in lock-step with `chunk`. When a token is
      // permanently invalid (uninstalled app, sign-out, expired token),
      // delete the row so future sends skip it.
      for (let k = 0; k < tickets.length; k++) {
        const ticket = tickets[k];
        if (ticket.status === "ok") {
          accepted++;
          continue;
        }
        rejected++;
        const reason = ticket.details?.error ?? "";
        if (reason === "DeviceNotRegistered" || reason === "InvalidCredentials") {
          // Hard-delete — Expo confirmed this token will never deliver.
          const deadToken = chunk[k]?.to;
          if (deadToken) {
            await prisma.pushToken
              .deleteMany({ where: { token: deadToken } })
              .catch((err) => console.warn("[push:send] dead-token cleanup failed:", err));
          }
        }
        console.warn("[push:send] ticket error", {
          userId: args.userId,
          reason,
          message: ticket.message,
        });
      }
    } catch (err) {
      // Network / parse failure — log and keep going. The next batch may
      // still succeed and we don't want one flaky batch to nuke the whole
      // send.
      console.error("[push:send] threw", {
        userId: args.userId,
        error: err instanceof Error ? err.message : String(err),
      });
      rejected += chunk.length;
    }
  }

  return { ok: rejected < messages.length, accepted, rejected };
}

// Convenience: send the same push to multiple users in one helper call.
// Used by the admin broadcast flow.
export async function sendPushBulk(
  userIds: string[],
  payload: Omit<SendPushArgs, "userId">,
): Promise<{ accepted: number; rejected: number }> {
  let accepted = 0;
  let rejected = 0;
  // Sequential — Expo's rate limit is per-token, not per-request, and the
  // broadcast loop already has its own pacing. Keeping this sequential
  // also avoids fanning out 1000+ in-flight fetches at once.
  for (const userId of userIds) {
    const r = await sendPush({ userId, ...payload });
    accepted += r.accepted;
    rejected += r.rejected;
  }
  return { accepted, rejected };
}
