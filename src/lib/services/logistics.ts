import { LogisticsProvider } from "@/services/logistics/logistics-provider";
import { ShipbubbleService } from "@/services/logistics/shipbubble.service";
import { KwikService } from "@/services/logistics/kwik.service";
import {
  GetRatesInput,
  NormalizedRateResponse,
  CreateShipmentInput,
  CreateShipmentResult,
  TrackingUpdate,
} from "@/services/logistics/logistics.types";

export type ProviderName = "SHIPBUBBLE" | "KWIK";

export class LogisticsService {
  private providers: Map<ProviderName, LogisticsProvider>;
  private primaryProviderName: ProviderName;
  private autoFallbackEnabled: boolean;

  constructor() {
    this.providers = new Map();
    this.providers.set("SHIPBUBBLE", new ShipbubbleService());
    this.providers.set("KWIK", new KwikService());

    // Resolve primary provider from environment
    const envProvider = process.env.LOGISTICS_PROVIDER?.toUpperCase();
    this.primaryProviderName = envProvider === "KWIK" ? "KWIK" : "SHIPBUBBLE";

    // Auto fallback setting
    this.autoFallbackEnabled =
      process.env.AUTO_FALLBACK_TO_KWIK === "1" ||
      process.env.AUTO_FALLBACK_TO_KWIK === "true";
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
   * Get shipping rates.
   *
   * Falls back to Kwik Delivery only when the primary provider actually throws
   * (network/auth/integration failure). An empty list is a legitimate "this
   * route isn't covered" answer and is returned as-is — Kwik only does Lagos
   * bike delivery, so falling back to it for a non-Lagos lane just produces a
   * second 'no coverage' answer, not a useful one.
   */
  async getShippingRates(input: GetRatesInput): Promise<NormalizedRateResponse[]> {
    const primary = this.primaryProviderName;
    console.log(`[Logistics] Fetching rates using primary provider: ${primary}`);

    try {
      const provider = this.getProvider(primary);
      return (await provider.getShippingRates(input)) ?? [];
    } catch (err) {
      console.warn(`[Logistics] Primary provider ${primary} rates fetch failed:`, err);

      if (primary === "SHIPBUBBLE" && this.autoFallbackEnabled) {
        console.log("[Logistics] Shipbubble failed, attempting automatic fallback to Kwik Delivery");
        try {
          const kwikProvider = this.getProvider("KWIK");
          return await kwikProvider.getShippingRates(input);
        } catch (fallbackErr) {
          console.error("[Logistics] Fallback to Kwik Delivery also failed:", fallbackErr);
          throw new Error(`Shipping rate fetch failed: both Shipbubble and Kwik Delivery are unavailable.`);
        }
      }
      throw err;
    }
  }

  /**
   * Create a shipment with automatic fallback.
   */
  async createShipment(
    args: CreateShipmentInput & { provider?: ProviderName }
  ): Promise<CreateShipmentResult & { finalProvider: ProviderName }> {
    const chosenProvider = args.provider || this.primaryProviderName;
    console.log(`[Logistics] Booking shipment with provider: ${chosenProvider}`);

    try {
      const provider = this.getProvider(chosenProvider);
      const result = await provider.createShipment(args);
      return {
        ...result,
        finalProvider: chosenProvider,
      };
    } catch (err) {
      console.warn(`[Logistics] Booking with provider ${chosenProvider} failed:`, err);

      // Fallback to Kwik if Shipbubble was requested and auto fallback is active
      if (chosenProvider === "SHIPBUBBLE" && this.autoFallbackEnabled) {
        console.log("[Logistics] Shipment booking failed on Shipbubble. Falling back to Kwik Delivery...");
        try {
          const kwikProvider = this.getProvider("KWIK");
          // Re-map courier parameters to suit Kwik's single bike dispatch rate
          const kwikInput: CreateShipmentInput = {
            ...args,
            courierId: "kwik_bike_delivery",
            courierCode: "bike",
          };
          const result = await kwikProvider.createShipment(kwikInput);
          return {
            ...result,
            finalProvider: "KWIK",
          };
        } catch (fallbackErr) {
          console.error("[Logistics] Fallback shipment booking on Kwik Delivery failed:", fallbackErr);
          throw new Error("Logistics booking failed on both Shipbubble and Kwik Delivery.");
        }
      }
      throw err;
    }
  }

  /**
   * Get tracking history.
   */
  async getTracking(args: {
    provider: ProviderName;
    externalId: string;
    trackingCode?: string;
  }): Promise<TrackingUpdate[]> {
    const provider = this.getProvider(args.provider);
    return provider.getTracking(args.externalId, args.trackingCode);
  }

  /**
   * Verify webhook signature.
   */
  verifyWebhookSignature(
    provider: ProviderName,
    rawBody: string,
    headerSignature: string
  ): boolean {
    const p = this.getProvider(provider);
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
