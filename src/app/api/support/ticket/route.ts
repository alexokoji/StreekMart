import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { notifyAdmins } from "@/lib/adminNotifications";
import { SUPPORT_EMAIL } from "@/lib/legalContent";

// POST /api/support/ticket { topic, message, name?, email? }
// Sends the message to the support inbox (reply-to is the user) and pings the
// admins. Works signed in or out; signed-in users' name and email come from
// their account. This is what the in-app Help screen uses, so nobody has to
// leave the app to contact support.
const Body = z.object({
  topic: z.string().trim().min(2).max(60),
  message: z.string().trim().min(5).max(4000),
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(200).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Write a short message so we can help." }, { status: 400 });
  }
  const session = await getSession();
  let name = parsed.data.name ?? "";
  let email = parsed.data.email ?? "";
  let account = "not signed in";
  if (session) {
    const me = await prisma.user.findUnique({ where: { id: session.sub }, select: { id: true, name: true, email: true } });
    if (me) {
      name = me.name;
      email = me.email;
      account = `user ${me.id}`;
    }
  }
  if (!email) return NextResponse.json({ error: "Add an email address so we can reply." }, { status: 400 });

  const subject = `[${parsed.data.topic}] StreekMart support — ${name || "anonymous"}`;
  const text = `From: ${name || "(no name)"} <${email}>\nAccount: ${account}\nTopic: ${parsed.data.topic}\n\n${parsed.data.message}`;
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  const result = await sendEmail({
    to: SUPPORT_EMAIL,
    subject,
    text,
    html: `<pre style="font-family:inherit;white-space:pre-wrap">${esc(text)}</pre>`,
    replyTo: email,
  });
  if (!result.ok) {
    return NextResponse.json({ error: "We couldn't send that right now. Please try again in a moment." }, { status: 502 });
  }
  void notifyAdmins({
    kind: "Support message",
    summary: `${name || email}: ${parsed.data.topic}`,
    link: "/admin",
    meta: [{ label: "From", value: email }],
  });
  return NextResponse.json({ ok: true });
}
