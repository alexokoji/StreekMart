// Payment gateway selector.
// Tries Korapay (primary) first; falls back to Monnify on failure.

import { PaymentGateway, InitCheckoutInput, InitCheckoutResult, VerifyPaymentInput, VerifyPaymentResult } from "@/lib/paymentGateway";
import { createKorapayGateway } from "@/lib/gateways/korapay";
import { createMonnifyGateway } from "@/lib/gateways/monnifyAdapter";

// Singleton instance
let primaryGateway: PaymentGateway | null = null;
let fallbackGateway: PaymentGateway | null = null;

export class GatewaySelector implements PaymentGateway {
  private primaryGateway: PaymentGateway;
  private fallbackGateway: PaymentGateway;

  constructor(primary: PaymentGateway, fallback: PaymentGateway) {
    this.primaryGateway = primary;
    this.fallbackGateway = fallback;
  }

  async initCheckout(input: InitCheckoutInput): Promise<InitCheckoutResult> {
    const errors: Array<{ gateway: string; error: string }> = [];

    // Try primary gateway (Korapay)
    try {
      const result = await this.primaryGateway.initCheckout(input);
      return {
        ...result,
        // Mark which gateway was used
      };
    } catch (err: any) {
      errors.push({
        gateway: this.primaryGateway.getName(),
        error: err?.message ?? String(err),
      });
      console.warn(`[Payment] ${this.primaryGateway.getName()} init failed, falling back to ${this.fallbackGateway.getName()}:`, err);
    }

    // Fallback to secondary gateway (Monnify)
    try {
      const result = await this.fallbackGateway.initCheckout(input);
      return result;
    } catch (err: any) {
      errors.push({
        gateway: this.fallbackGateway.getName(),
        error: err?.message ?? String(err),
      });
      console.error("[Payment] All gateways failed:", errors);
      throw new Error(`Payment initialization failed. Errors: ${JSON.stringify(errors)}`);
    }
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    // Try primary first
    try {
      return await this.primaryGateway.verifyPayment(input);
    } catch (err: any) {
      console.warn(`[Payment] ${this.primaryGateway.getName()} verify failed, trying ${this.fallbackGateway.getName()}:`, err);
    }

    // Fallback to secondary
    return await this.fallbackGateway.verifyPayment(input);
  }

  isStubMode(): boolean {
    return this.primaryGateway.isStubMode();
  }

  getName(): string {
    return `${this.primaryGateway.getName()} (fallback: ${this.fallbackGateway.getName()})`;
  }
}

// Initialize and export singleton
export function getGatewaySelector(): PaymentGateway {
  if (!primaryGateway) {
    primaryGateway = createKorapayGateway();
  }
  if (!fallbackGateway) {
    fallbackGateway = createMonnifyGateway();
  }
  return new GatewaySelector(primaryGateway, fallbackGateway);
}
