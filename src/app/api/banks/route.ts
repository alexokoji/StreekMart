import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { BANKS } from "@/lib/banks";
import { isKorapayLive, listKorapayBanks } from "@/lib/korapayBank";

// GET /api/banks — banks a seller can be paid to. Live: Korapay's own list
// (so the codes match what Korapay pays out with). Otherwise, or if Korapay
// can't be reached, a built-in list of common banks. `verifiable` tells the
// client whether account names can be checked with the bank right now.
export async function GET() {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const verifiable = isKorapayLive();
  if (verifiable) {
    try {
      const banks = await listKorapayBanks();
      if (banks.length > 0) {
        return NextResponse.json({ banks: banks.map((b) => ({ value: b.code, label: b.name })), verifiable });
      }
    } catch (err) {
      console.error("[banks] Korapay list failed, using built-in list", err);
    }
  }
  return NextResponse.json({ banks: BANKS, verifiable });
}
