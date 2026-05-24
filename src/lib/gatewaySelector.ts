// Payment gateway abstraction layer.
// Primary: Korapay only. No fallback.

import { PaymentGateway, InitCheckoutInput, InitCheckoutResult, VerifyPaymentInput, VerifyPaymentResult } from "@/lib/paymentGateway";
import { createKorapayGateway } from "@/lib/gateways/korapay";

// Singleton instance
let primaryGateway: PaymentGateway | null = null;

export class GatewaySelector implements PaymentGateway {
  private primaryGateway: PaymentGateway;

  constructor(primary: PaymentGateway) {
    this.primaryGateway = primary;
  }

  async initCheckout(input: InitCheckoutInput): Promise<InitCheckoutResult> {
    try {
      return await this.primaryGateway.initCheckout(input);
    } catch (err: any) {
      console.error(`[Payment] ${this.primaryGateway.getName()} init failed:`, err);
      throw new Error(`Payment initialization failed: ${err?.message ?? String(err)}`);
    }
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    return await this.primaryGateway.verifyPayment(input);
  }

  isStubMode(): boolean {
    return this.primaryGateway.isStubMode();
  }

  getName(): string {
    return this.primaryGateway.getName();
  }
}

// Initialize and export singleton
export function getGatewaySelector(): PaymentGateway {
  if (!primaryGateway) {
    primaryGateway = createKorapayGateway();
  }
  return new GatewaySelector(primaryGateway);
}
