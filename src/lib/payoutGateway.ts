// One place that sends money to a bank account. Korapay when it's live;
// otherwise the older Monnify path (which itself simulates in test mode), so
// development and anyone still on Monnify keep working.

import { disburse as monnifyDisburse } from "@/lib/monnify";
import { isKorapayLive, korapayDisburse, type TransferResult } from "@/lib/korapayBank";

export async function disburseToBank(input: {
  amountCents: number;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  reference: string;
  narration: string;
  customerEmail: string;
}): Promise<TransferResult> {
  if (isKorapayLive()) return korapayDisburse(input);
  const r = await monnifyDisburse({
    amountCents: input.amountCents,
    destinationAccountNumber: input.accountNumber,
    destinationBankCode: input.bankCode,
    reference: input.reference,
    narration: input.narration,
  });
  return { status: r.status as TransferResult["status"], externalReference: r.externalReference, message: r.message };
}
