import { LogisticsProvider } from "@/lib/logistics";
import { getSendboxProvider } from "@/lib/providers/sendbox";

type ProviderName = "SENDBOX" | "JUMIA" | "DELLYMAN" | "GIGL" | "KWIK";

/**
 * Service for managing shipping operations across multiple logistics providers.
 * Handles provider selection, rate quoting, shipment creation, and tracking.
 */
export class LogisticsService {
  private providers: Map<ProviderName, LogisticsProvider>;

  constructor() {
    this.providers = new Map();
    this.initializeProviders();
  }

  private initializeProviders(): void {
    this.providers.set("SENDBOX", getSendboxProvider());
    // Future providers can be initialized here
    // this.providers.set("JUMIA", getJumiaProvider());
    // this.providers.set("DELLYMAN", getDellymanProvider());
  }

  /**
   * Get a logistics provider by name.
   */
  getProvider(name: ProviderName): LogisticsProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Logistics provider '${name}' is not configured`);
    }
    return provider;
  }

  /**
   * Get list of available providers.
   */
  getAvailableProviders(): ProviderName[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get shipping rates from a specific provider.
   */
  async getShippingRates(args: {
    provider: ProviderName;
    pickupAddress: string;
    pickupCity: string;
    pickupState?: string;
    pickupPostalCode?: string;
    pickupCountry: string;
    deliveryAddress: string;
    deliveryCity: string;
    deliveryState?: string;
    deliveryPostalCode?: string;
    deliveryCountry: string;
    weight?: number;
    width?: number;
    height?: number;
    length?: number;
    description?: string;
  }) {
    const provider = this.getProvider(args.provider);

    if (args.provider === "SENDBOX") {
      const sendboxProvider = provider as any;
      return sendboxProvider.getShippingRates({
        pickupAddress: args.pickupAddress,
        pickupCity: args.pickupCity,
        pickupState: args.pickupState,
        pickupPostalCode: args.pickupPostalCode,
        pickupCountry: args.pickupCountry,
        deliveryAddress: args.deliveryAddress,
        deliveryCity: args.deliveryCity,
        deliveryState: args.deliveryState,
        deliveryPostalCode: args.deliveryPostalCode,
        deliveryCountry: args.deliveryCountry,
        weight: args.weight,
        width: args.width,
        height: args.height,
        length: args.length,
        description: args.description,
      });
    }

    throw new Error(`Provider ${args.provider} rate quoting not implemented`);
  }

  /**
   * Create a shipment with a specific provider.
   */
  async createShipment(args: {
    provider: ProviderName;
    orderId: string;
    recipientName: string;
    recipientPhone: string;
    recipientAddress: string;
    weight?: number;
    dimensions?: { length: number; width: number; height: number };
    description?: string;
    specialHandling?: string;
  }) {
    const provider = this.getProvider(args.provider);
    return provider.createShipment({
      orderId: args.orderId,
      recipientName: args.recipientName,
      recipientPhone: args.recipientPhone,
      recipientAddress: args.recipientAddress,
      weight: args.weight,
      dimensions: args.dimensions,
      description: args.description,
      specialHandling: args.specialHandling,
    });
  }

  /**
   * Get tracking information from a specific provider.
   */
  async getTracking(args: {
    provider: ProviderName;
    externalId: string;
    trackingCode?: string;
  }) {
    const provider = this.getProvider(args.provider);
    return provider.getTracking({
      externalId: args.externalId,
      trackingCode: args.trackingCode,
    });
  }

  /**
   * Verify webhook signature from a provider.
   */
  verifyWebhookSignature(
    provider: ProviderName,
    rawBody: string,
    headerSignature: string,
  ): boolean {
    const p = this.getProvider(provider);
    if (!p.verifyWebhookSignature) {
      return false;
    }
    return p.verifyWebhookSignature(rawBody, headerSignature);
  }
}

// Singleton instance
let logisticsServiceInstance: LogisticsService | null = null;

export function getLogisticsService(): LogisticsService {
  if (!logisticsServiceInstance) {
    logisticsServiceInstance = new LogisticsService();
  }
  return logisticsServiceInstance;
}
