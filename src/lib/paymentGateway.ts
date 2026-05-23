// Payment Gateway abstraction layer.
// All payment providers implement this interface, allowing swappable gateways.

export type InitCheckoutInput = {
  amountCents: number;
  customerEmail: string;
  customerName: string;
  description: string;
  paymentReference: string;
  redirectUrl: string;
};

export type InitCheckoutResult = {
  checkoutUrl: string;
  transactionReference: string;
  paymentReference: string;
};

export type VerifyPaymentInput = {
  paymentReference: string;
  transactionReference: string;
};

export type VerifyPaymentResult = {
  status: "pending" | "processing" | "completed" | "failed";
  amountCents?: number;
  message?: string;
};

export interface PaymentGateway {
  // Initialize a payment checkout session.
  initCheckout(input: InitCheckoutInput): Promise<InitCheckoutResult>;
  // Verify a payment by reference (used in webhook handlers).
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
  // Check if stub mode is active (for development).
  isStubMode(): boolean;
  // Get the gateway name for logging/tracking.
  getName(): string;
}
