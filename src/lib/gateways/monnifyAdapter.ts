// Monnify payment gateway adapter.
// Wraps the existing Monnify integration to implement PaymentGateway interface.

import { PaymentGateway, InitCheckoutInput, InitCheckoutResult, VerifyPaymentInput, VerifyPaymentResult } from "@/lib/paymentGateway";
import { randomBytes } from "node:crypto";

export class MonnifyGateway implements PaymentGateway {
  private isStub = process.env.MONNIFY_LIVE !== "1";

  async initCheckout(input: InitCheckoutInput): Promise<InitCheckoutResult> {
    if (this.isStub) return this.stubInitCheckout(input);

    const token = await this.getAccessToken();
    const response = await this.monnifyFetch("/api/v1/merchant/transactions/init-transaction", {
      method: "POST",
      token,
      body: {
        amount: input.amountCents / 100,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        paymentReference: input.paymentReference,
        paymentDescription: input.description,
        currencyCode: "NGN",
        contractCode: this.requireEnv("MONNIFY_CONTRACT_CODE"),
        redirectUrl: input.redirectUrl,
        paymentMethods: ["CARD", "ACCOUNT_TRANSFER", "USSD"],
      },
    });

    const body = response.responseBody;
    return {
      checkoutUrl: body.checkoutUrl,
      transactionReference: body.transactionReference,
      paymentReference: body.paymentReference,
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    if (this.isStub) return this.stubVerifyPayment();

    const token = await this.getAccessToken();
    const response = await this.monnifyFetch(
      `/api/v1/merchant/transactions/query?paymentReference=${encodeURIComponent(input.paymentReference)}`,
      {
        method: "GET",
        token,
        body: null,
      }
    );

    const body = response.responseBody;
    const status = body.status?.toLowerCase();

    return {
      status: this.mapStatus(status),
      amountCents: body.amount ? Math.round(body.amount * 100) : undefined,
      message: body.paymentDescription,
    };
  }

  isStubMode(): boolean {
    return this.isStub;
  }

  getName(): string {
    return "MONNIFY";
  }

  // ---- Internal methods ----

  private async getAccessToken(): Promise<string> {
    // Simple cache (reuse for 5 mins)
    if (this.cachedToken && this.cachedToken.expiresAt - 30_000 > Date.now()) {
      return this.cachedToken.token;
    }

    const apiKey = this.requireEnv("MONNIFY_API_KEY");
    const secret = this.requireEnv("MONNIFY_SECRET_KEY");
    const auth = Buffer.from(`${apiKey}:${secret}`).toString("base64");
    const url = `${this.baseUrl()}/api/v1/auth/login`;

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!res.ok) throw new Error(`Monnify auth failed: ${res.status}`);

    const data = (await res.json()) as { responseBody: { accessToken: string; expiresIn: number } };
    this.cachedToken = {
      token: data.responseBody.accessToken,
      expiresAt: Date.now() + data.responseBody.expiresIn * 1000,
    };

    return this.cachedToken.token;
  }

  private async monnifyFetch(
    path: string,
    init: { method: string; token: string; body: any }
  ): Promise<{ responseBody: any }> {
    const url = `${this.baseUrl()}${path}`;
    const res = await fetch(url, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${init.token}`,
        "Content-Type": "application/json",
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });

    const json = (await res.json().catch(() => ({}))) as { responseBody?: any; responseMessage?: string };
    if (!res.ok || !json.responseBody) {
      throw new Error(json.responseMessage ?? `Monnify request failed (${res.status})`);
    }

    return json as { responseBody: any };
  }

  private baseUrl(): string {
    return process.env.MONNIFY_BASE_URL ?? "https://sandbox.monnify.com";
  }

  private requireEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`${name} is not set`);
    return v;
  }

  private mapStatus(status: string | undefined): VerifyPaymentResult["status"] {
    switch (status) {
      case "paid":
      case "success":
        return "completed";
      case "failed":
      case "pending":
        return status === "pending" ? "pending" : "failed";
      default:
        return "pending";
    }
  }

  private stubInitCheckout(input: InitCheckoutInput): InitCheckoutResult {
    const ref = `MONNIFY_STUB_${randomBytes(6).toString("hex").toUpperCase()}`;
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

  private cachedToken: { token: string; expiresAt: number } | null = null;
}

export function createMonnifyGateway(): PaymentGateway {
  return new MonnifyGateway();
}
