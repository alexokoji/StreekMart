import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Real database (dev SQLite); only auth and outbound notifications are stubbed.
let current = "";
vi.mock("@/lib/auth", () => ({
  requireApiUser: async () => ({ session: { sub: current, email: "x@test.dev", name: "T" } }),
}));
vi.mock("@/lib/notifications", () => ({ sendPush: async () => ({ ok: true }) }));
vi.mock("@/lib/email", async (orig) => ({ ...(await orig<object>()), sendEmail: async () => ({ ok: true }) }));

import { prisma } from "@/lib/db";
import { GET } from "@/app/api/orders/transfer/[reference]/route";
import { POST as proof } from "@/app/api/orders/transfer/[reference]/proof/route";
import { POST as review } from "@/app/api/orders/transfer/[reference]/review/route";
import { newTransferReference } from "@/lib/directTransfer";

const tag = `t${Date.now()}`;
const ref = newTransferReference();
let buyerId = "", sellerId = "", strangerId = "", orderId = "";
const req = (body: object) => new Request("http://x", { method: "POST", body: JSON.stringify(body) });
const ctx = { params: { reference: ref } };

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const mk = (n: string) => prisma.user.create({ data: { email: `${n}-${tag}@test.dev`, name: n, passwordHash: "x" } });
  const [b, s, o] = await Promise.all([mk("buyer"), mk("seller"), mk("stranger")]);
  buyerId = b.id; sellerId = s.id; strangerId = o.id;
  await prisma.user.update({
    where: { id: sellerId },
    data: { directPayEnabled: true, directBankCode: "058", directAccountNumber: "0123456789", directAccountName: "TEST SELLER" },
  });
  const product = await prisma.product.create({
    data: { name: "Ankara", description: "d", price: 10000, sellerId, category: "Tops", imagesJson: '["https://x/a.jpg"]' } as never,
  });
  const order = await prisma.order.create({
    data: {
      productId: product.id, buyerId, sellerId, totalPrice: 12000, deliveryFeeCents: 200000,
      directPayout: true, status: "PENDING", paymentReference: ref, transferReference: ref,
      transferStatus: "AWAITING_TRANSFER", paymentGateway: "BANK_TRANSFER",
    },
  });
  orderId = order.id;
});

afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  await prisma.order.deleteMany({ where: { sellerId } });
  await prisma.product.deleteMany({ where: { sellerId } });
  await prisma.user.deleteMany({ where: { id: { in: [buyerId, sellerId, strangerId] } } });
});

// Needs a real SQLite database: DATABASE_URL=file:./x.db npx prisma db push first.
describe.skipIf(!process.env.DATABASE_URL)("direct-pay bank transfer verification", () => {
  it("shows the buyer the seller's bank details, exact amount and reference", async () => {
    current = buyerId;
    const d = await (await GET(new Request("http://x"), ctx)).json();
    expect(d.role).toBe("buyer");
    expect(d.amount).toBe(12000);
    expect(d.seller.accountNumber).toBe("0123456789");
    expect(d.reference).toBe(ref);
  });
  it("hides it from anyone else", async () => {
    current = strangerId;
    expect((await GET(new Request("http://x"), ctx)).status).toBe(403);
    expect((await review(req({ action: "confirm" }), ctx)).status).toBe(403);
  });
  it("buyer uploads a receipt, the seller sees it", async () => {
    current = buyerId;
    expect((await proof(req({ proofUrl: "https://x/receipt.jpg", senderName: "Ada" }), ctx)).status).toBe(200);
    current = sellerId;
    const d = await (await GET(new Request("http://x"), ctx)).json();
    expect(d.role).toBe("seller");
    expect(d.status).toBe("PROOF_SUBMITTED");
    expect(d.proofUrl).toBe("https://x/receipt.jpg");
  });
  it("rejecting needs a reason, then the buyer can re-upload", async () => {
    current = sellerId;
    expect((await review(req({ action: "reject" }), ctx)).status).toBe(400);
    expect((await review(req({ action: "reject", reason: "amount not received" }), ctx)).status).toBe(200);
    current = buyerId;
    expect((await proof(req({ proofUrl: "https://x/r2.jpg" }), ctx)).status).toBe(200);
  });
  it("confirming marks the order paid with a delivery code and pays nothing out", async () => {
    current = sellerId;
    expect((await review(req({ action: "confirm" }), ctx)).status).toBe(200);
    const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(o.status).toBe("PAID");
    expect(o.transferStatus).toBe("CONFIRMED");
    expect(o.deliveryCode).toBeTruthy();
    expect(o.heldCents).toBe(0);
    expect(await prisma.payoutRequest.count({ where: { orderId } })).toBe(0);
    // can't be confirmed twice, and no new receipt after confirmation
    expect((await review(req({ action: "confirm" }), ctx)).status).toBe(400);
    current = buyerId;
    expect((await proof(req({ proofUrl: "https://x/r3.jpg" }), ctx)).status).toBe(400);
  });
});
