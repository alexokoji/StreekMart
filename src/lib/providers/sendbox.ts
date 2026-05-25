import { LogisticsProvider, CreateShipmentInput, CreateShipmentResult, GetTrackingInput, GetTrackingResult } from "@/lib/logistics";

export interface SendboxCourierOption {
  id: string;
  name: string;
  code: string;
  description?: string;
  estimatedDays?: number;
  price?: number;
}

export interface SendboxRateQuote {
  couriers: SendboxCourierOption[];
}

export class SendboxProvider implements LogisticsProvider {
  private apiKey: string;
  private baseUrl: string;
  private isLive: boolean;

  constructor() {
    this.apiKey = process.env.SENDBOX_API_KEY || "";
    this.baseUrl = process.env.SENDBOX_BASE_URL || "https://sandbox.staging.sendbox.co";
    this.isLive = process.env.SENDBOX_LIVE === "1";
  }

  getName(): string {
    return "SENDBOX";
  }

  /**
   * Get shipping rate quotes from Sendbox.
   * Returns available courier options with pricing.
   */
  async getShippingRates(input: {
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
  }): Promise<SendboxRateQuote> {
    if (!this.isLive) {
      return this.stubGetRates();
    }

    if (!this.apiKey) {
      throw new Error("SENDBOX_API_KEY environment variable is not set");
    }

    try {
      const response = await fetch(`${this.baseUrl}/shipping/shipments/quote`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pickup_location: {
            address: input.pickupAddress,
            city: input.pickupCity,
            state: input.pickupState,
            postal_code: input.pickupPostalCode,
            country: input.pickupCountry,
          },
          delivery_location: {
            address: input.deliveryAddress,
            city: input.deliveryCity,
            state: input.deliveryState,
            postal_code: input.deliveryPostalCode,
            country: input.deliveryCountry,
          },
          shipment_weight: input.weight ? Math.ceil(input.weight * 1000) : 1000, // grams
          shipment_dimensions:
            input.length && input.width && input.height
              ? {
                  length: input.length,
                  width: input.width,
                  height: input.height,
                }
              : undefined,
          shipment_description: input.description || "Fashion items",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Sendbox API error (${response.status}): ${errorText || response.statusText}`
        );
      }

      const data = await response.json();
      return this.mapSendboxRatesToCouriers(data);
    } catch (err) {
      console.error("Sendbox getShippingRates error:", err);
      throw new Error(
        err instanceof Error
          ? `Sendbox rates failed: ${err.message}`
          : "Failed to fetch shipping rates from Sendbox"
      );
    }
  }

  /**
   * Create a shipment with Sendbox.
   */
  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    if (!this.isLive) {
      return this.stubCreateShipment();
    }

    try {
      const response = await fetch(`${this.baseUrl}/shipping/shipments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          external_reference: input.orderId,
          receiver: {
            name: input.recipientName,
            phone: input.recipientPhone,
            address: input.recipientAddress,
          },
          shipment_weight: input.weight ? Math.ceil(input.weight * 1000) : 1000,
          shipment_description: input.description || "Fashion items",
          special_handling: input.specialHandling,
          dimensions:
            input.dimensions && input.dimensions.length
              ? {
                  length: input.dimensions.length,
                  width: input.dimensions.width,
                  height: input.dimensions.height,
                }
              : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Sendbox API error: ${response.statusText}`);
      }

      const data = await response.json();
      return this.mapSendboxShipmentToResult(data);
    } catch (err) {
      console.error("Sendbox create shipment error:", err);
      throw new Error("Failed to create shipment with Sendbox");
    }
  }

  /**
   * Track a shipment with Sendbox.
   */
  async getTracking(input: GetTrackingInput): Promise<GetTrackingResult> {
    if (!this.isLive) {
      return this.stubGetTracking();
    }

    try {
      const url = input.trackingCode
        ? `${this.baseUrl}/shipping/shipments/track/${input.trackingCode}`
        : `${this.baseUrl}/shipping/shipments/${input.externalId}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Sendbox API error: ${response.statusText}`);
      }

      const data = await response.json();
      return this.mapSendboxTrackingToResult(data);
    } catch (err) {
      console.error("Sendbox tracking error:", err);
      throw new Error("Failed to fetch tracking from Sendbox");
    }
  }

  /**
   * Verify Sendbox webhook signature.
   */
  verifyWebhookSignature(rawBody: string, headerSignature: string): boolean {
    const secret = process.env.SENDBOX_WEBHOOK_SECRET || "";
    if (!secret) return false;

    const crypto = require("crypto");
    const hash = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    return hash === headerSignature;
  }

  // ==================== Private Helpers ====================

  private stubGetRates(): SendboxRateQuote {
    return {
      couriers: [
        {
          id: "sendbox_economy",
          name: "Economy Delivery",
          code: "ECONOMY",
          description: "Standard delivery in 3-5 business days",
          estimatedDays: 5,
          price: 1500, // cents (e.g., $15)
        },
        {
          id: "sendbox_standard",
          name: "Standard Delivery",
          code: "STANDARD",
          description: "Delivery in 2-3 business days",
          estimatedDays: 3,
          price: 2500, // $25
        },
        {
          id: "sendbox_express",
          name: "Express Delivery",
          code: "EXPRESS",
          description: "Next business day delivery",
          estimatedDays: 1,
          price: 5000, // $50
        },
      ],
    };
  }

  private stubCreateShipment(): CreateShipmentResult {
    const trackingCode = `SENDBOX-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const externalId = `SBX-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    return {
      externalId,
      trackingCode,
      labelUrl: `https://sendbox.local/labels/${externalId}.pdf`,
      receiptUrl: `https://sendbox.local/receipts/${externalId}.pdf`,
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
    };
  }

  private stubGetTracking(): GetTrackingResult {
    const statuses: GetTrackingResult["status"][] = [
      "pending",
      "picked",
      "in_transit",
      "out_for_delivery",
      "delivered",
    ];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

    return {
      status: randomStatus,
      lastUpdate: new Date(),
      currentLocation: "Distribution Center, Lagos",
      estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      message: `Your package is ${randomStatus}`,
      labelUrl: "https://sendbox.local/labels/sample.pdf",
    };
  }

  private mapSendboxRatesToCouriers(data: any): SendboxRateQuote {
    const couriers = (data.couriers || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      description: c.description,
      estimatedDays: c.estimated_days,
      price: c.price, // Expected in cents
    }));

    return { couriers };
  }

  private mapSendboxShipmentToResult(data: any): CreateShipmentResult {
    return {
      externalId: data.id,
      trackingCode: data.tracking_code,
      labelUrl: data.label_url,
      receiptUrl: data.receipt_url,
      estimatedDelivery: data.estimated_delivery
        ? new Date(data.estimated_delivery)
        : undefined,
    };
  }

  private mapSendboxTrackingToResult(data: any): GetTrackingResult {
    const statusMap: Record<string, GetTrackingResult["status"]> = {
      pending: "pending",
      picked: "picked",
      in_transit: "in_transit",
      out_for_delivery: "out_for_delivery",
      delivered: "delivered",
      failed: "failed",
    };

    return {
      status: statusMap[data.status] || "pending",
      lastUpdate: new Date(data.last_update || Date.now()),
      currentLocation: data.current_location,
      estimatedDelivery: data.estimated_delivery
        ? new Date(data.estimated_delivery)
        : undefined,
      message: data.message,
      labelUrl: data.label_url,
      receiptUrl: data.receipt_url,
    };
  }
}

export function getSendboxProvider(): SendboxProvider {
  return new SendboxProvider();
}
