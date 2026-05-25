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
  private accessToken: string;
  private baseUrl: string;
  private isLive: boolean;

  constructor() {
    this.accessToken = process.env.SENDBOX_ACCESS_TOKEN || "";
    this.baseUrl = process.env.SENDBOX_BASE_URL || "https://live.sendbox.co";
    this.isLive = process.env.SENDBOX_LIVE === "1";
  }

  getName(): string {
    return "SENDBOX";
  }

  /**
   * Get shipping rate quotes from Sendbox.
   * Returns available courier options with pricing.
   * Endpoint: POST /shipping/shipments/delivery_quote
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

    if (!this.accessToken) {
      throw new Error("SENDBOX_ACCESS_TOKEN environment variable is not set");
    }

    console.log("Sendbox getShippingRates debug:", {
      tokenLength: this.accessToken?.length,
      baseUrl: this.baseUrl,
      endpoint: `${this.baseUrl}/shipping/shipments/delivery_quote`,
      isLive: this.isLive,
    });

    try {
      const payload = {
        origin: {
          address: input.pickupAddress,
          city: input.pickupCity,
          state: input.pickupState || "",
          postal_code: input.pickupPostalCode || "",
          country: "NG",
          phone: "+234000000000",
        },
        destination: {
          address: input.deliveryAddress,
          city: input.deliveryCity,
          state: input.deliveryState || "",
          postal_code: input.deliveryPostalCode || "",
          country: "NG",
          phone: "+234000000000",
        },
        package: {
          weight: input.weight || 1,
          value: 0,
        },
        currency: "NGN",
        region: "NG",
      };

      console.log("Sendbox quote request payload:", payload);

      const response = await fetch(`${this.baseUrl}/shipping/shipments/delivery_quote`, {
        method: "POST",
        headers: {
          Authorization: this.accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log("Sendbox quote response status:", response.status);
      console.log("Sendbox quote response body:", responseText);

      if (!response.ok) {
        throw new Error(
          `Sendbox API error (${response.status}): ${responseText || response.statusText}`
        );
      }

      const data = JSON.parse(responseText);
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
   * Endpoint: POST /shipping/shipments
   */
  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    if (!this.isLive) {
      return this.stubCreateShipment();
    }

    if (!this.accessToken) {
      throw new Error("SENDBOX_ACCESS_TOKEN environment variable is not set");
    }

    try {
      const payload = {
        origin: {
          name: input.senderName || "StreekMart Seller",
          phone: input.senderPhone || "0800000000",
          address: input.pickupAddress || "StreekMart Warehouse",
          country: "NG",
        },
        destination: {
          name: input.recipientName,
          phone: input.recipientPhone,
          address: input.recipientAddress,
          country: "NG",
        },
        package: {
          weight: input.weight || 1,
          value: input.value || 0,
        },
        currency: "NGN",
        region: "NG",
      };

      console.log("Sendbox create shipment payload:", payload);

      const response = await fetch(`${this.baseUrl}/shipping/shipments`, {
        method: "POST",
        headers: {
          Authorization: this.accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log("Sendbox create response status:", response.status);
      console.log("Sendbox create response body:", responseText);

      if (!response.ok) {
        throw new Error(`Sendbox API error: ${response.status} - ${responseText}`);
      }

      const data = JSON.parse(responseText);
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

    if (!this.accessToken) {
      throw new Error("SENDBOX_ACCESS_TOKEN environment variable is not set");
    }

    try {
      const trackingId = input.trackingCode || input.externalId;
      const response = await fetch(
        `${this.baseUrl}/shipping/shipments/${trackingId}`,
        {
          headers: {
            Authorization: this.accessToken,
          },
        }
      );

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
      externalId: data.tracking_id || data.id,
      trackingCode: data.tracking_id,
      labelUrl: data.label_url || "",
      receiptUrl: data.receipt_url || "",
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
