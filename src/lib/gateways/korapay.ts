// Korapay payment gateway adapter.
// Implements the PaymentGateway interface for Korapay integration.

import { PaymentGateway, InitCheckoutInput, InitCheckoutResult, VerifyPaymentInput, VerifyPaymentResult } from "@/lib/paymentGateway";
import { randomBytes } from "node:crypto";

export class KorapayGateway implements PaymentGateway {
  private isStub = process.env.KORAPAY_LIVE !== "1";

  async initCheckout(input: InitCheckoutInput): Promise<InitCheckoutResult> {
    if (this.isStub) return this.stubInitCheckout(input);

    const secretKey = this.requireEnv("KORAPAY_SECRET_KEY");
    const encryptionKey = process.env.KORAPAY_ENCRYPTION_KEY; // Optional, for request encryption
    const url = `${this.baseUrl()}/merchant/transactions/initialize`;

    const payload = {
      amount: input.amountCents / 100,
      currency: "NGN",
      reference: input.paymentReference,
      customer: {
        name: input.customerName,
        email: input.customerEmail,
      },
      channels: ["card", "bank_transfer", "ussd"],
      notification_url: `${this.getNotificationUrl()}/api/korapay/webhook`,
      redirect_url: input.redirectUrl,
      metadata: {
        description: input.description,
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secretKey}`,
        ...(encryptionKey && { "X-Korapay-Encryption-Key": encryptionKey }),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Korapay init failed: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as any;
    if (!data.data?.checkout_url) {
      throw new Error(`Korapay init failed: ${JSON.stringify(data)}`);
    }

    return {
      checkoutUrl: data.data.checkout_url,
      transactionReference: data.data.transaction_id,
      paymentReference: input.paymentReference,
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    if (this.isStub) return this.stubVerifyPayment();

    const secretKey = this.requireEnv("KORAPAY_SECRET_KEY");
    const encryptionKey = process.env.KORAPAY_ENCRYPTION_KEY;
    const url = `${this.baseUrl()}/merchant/transactions/verify/${input.transactionReference}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        ...(encryptionKey && { "X-Korapay-Encryption-Key": encryptionKey }),
      },
    });

    if (!response.ok) {
      throw new Error(`Korapay verify failed: ${response.status}`);
    }

    const data = (await response.json()) as any;
    const status = data.data?.status?.toLowerCase();

    return {
      status: this.mapStatus(status),
      amountCents: data.data?.amount ? Math.round(data.data.amount * 100) : undefined,
      message: data.data?.reason,
    };
  }

  isStubMode(): boolean {
    return this.isStub;
  }

  getName(): string {
    return "KORAPAY";
  }

  // Verify Korapay webhook signature (HMAC-SHA256)
  // Per Korapay docs: signature is HMAC-SHA256 of ONLY the data object
  verifyWebhookSignature(rawDataObject: string, headerSignature: string): boolean {
    const secret = process.env.KORAPAY_SECRET_KEY;
    if (!secret) {
      console.warn("[Korapay] KORAPAY_SECRET_KEY not set, skipping signature verification");
      return true; // Allow in dev without secret
    }

    const crypto = require("node:crypto") as typeof import("node:crypto");
    // Sign the data object as per Korapay spec
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawDataObject)
      .digest("hex");

    return this.timingSafeEqual(expected, headerSignature);
  }

  // ---- Internal helpers ----

  private baseUrl(): string {
    return process.env.KORAPAY_BASE_URL ?? "https://api.korapay.com";
  }

  private getNotificationUrl(): string {
    return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  }

  private requireEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`${name} is not set`);
    return v;
  }

  private mapStatus(status: string | undefined): VerifyPaymentResult["status"] {
    switch (status) {
      case "success":
      case "completed":
        return "completed";
      case "failed":
      case "declined":
        return "failed";
      case "pending":
        return "pending";
      case "processing":
        return "processing";
      default:
        return "pending";
    }
  }

  private stubInitCheckout(input: InitCheckoutInput): InitCheckoutResult {
    const ref = `KORAPAY_STUB_${randomBytes(6).toString("hex").toUpperCase()}`;
    return {
      checkoutUrl: `/cart/checkout?stubRef=${encodeURIComponent(ref)}`,
      transactionReference: ref,
      paymentReference: input.paymentReference,
    };
  }

  private stubVerifyPayment(): VerifyPaymentResult {
    return {
      status: "completed",
      message: "Stub verification — test mode",
    };
  }

  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
  }
}

export function createKorapayGateway(): PaymentGateway {
  return new KorapayGateway();
}
