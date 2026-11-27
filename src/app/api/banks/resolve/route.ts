import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { resolveBankAccount } from "@/lib/korapayBank";

// POST /api/banks/resolve { bankCode, accountNumber }
// Asks the bank who owns the account and returns the name it has on file.
// `unavailable: true` means verification can't be done right now (test mode
// or the bank didn't answer), so the client may fall back to a typed name.
const Body = z.object({ bankCode: z.string().min(2).max(12), accountNumber: z.string() });

export async function POST(req: Request) {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  const r = await resolveBankAccount(parsed.data.bankCode, parsed.data.accountNumber.trim());
  return NextResponse.json(r);
}
