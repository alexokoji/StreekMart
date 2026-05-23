// Jumia Logistics provider adapter.
// Implements the LogisticsProvider interface for Jumia integration.

import { LogisticsProvider, CreateShipmentInput, CreateShipmentResult, GetTrackingInput, GetTrackingResult } from "@/lib/logistics";

export class JumiaLogisticsProvider implements LogisticsProvider {
  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const apiKey = this.requireEnv("JUMIA_LOGISTICS_API_KEY");
    const url = `${this.baseUrl()}/shipments/create`;

    const payload = {
      recipient_name: input.recipientName,
      recipient_phone: input.recipientPhone,
      recipient_address: input.recipientAddress,
      weight_kg: input.weight || 1,
      ...(input.dimensions && {
        length_cm: input.dimensions.length,
        width_cm: input.dimensions.width,
        height_cm: input.dimensions.height,
      }),
      description: input.description || "Order shipment",
      special_handling: input.specialHandling,
      metadata: {
        order_id: input.orderId,
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jumia create shipment failed: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as any;
    if (!data.tracking_code || !data.shipment_id) {
      throw new Error("Jumia response missing required fields");
    }

    return {
      externalId: data.shipment_id,
      trackingCode: data.tracking_code,
      labelUrl: data.label_url || undefined,
      receiptUrl: data.receipt_url || undefined,
      estimatedDelivery: data.estimated_delivery ? new Date(data.estimated_delivery) : undefined,
    };
  }

  async getTracking(input: GetTrackingInput): Promise<GetTrackingResult> {
    const apiKey = this.requireEnv("JUMIA_LOGISTICS_API_KEY");
    const url = `${this.baseUrl()}/shipments/${input.externalId}/tracking`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Jumia get tracking failed: ${response.status}`);
    }

    const data = (await response.json()) as any;

    return {
      status: this.mapStatus(data.status),
      lastUpdate: new Date(data.last_update || Date.now()),
      currentLocation: data.current_location || undefined,
      estimatedDelivery: data.estimated_delivery ? new Date(data.estimated_delivery) : undefined,
      message: data.message || undefined,
      labelUrl: data.label_url || undefined,
      receiptUrl: data.receipt_url || undefined,
    };
  }

  getName(): string {
    return "JUMIA";
  }

  verifyWebhookSignature(rawBody: string, headerSignature: string): boolean {
    const secret = process.env.JUMIA_LOGISTICS_WEBHOOK_SECRET;
    if (!secret) return false;

    const crypto = require("node:crypto") as typeof import("node:crypto");
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

    return this.timingSafeEqual(expected, headerSignature);
  }

  // ---- Internal helpers ----

  private baseUrl(): string {
    return process.env.JUMIA_LOGISTICS_BASE_URL || "https://api.jumia.co.ke/logistics/v1";
  }

  private requireEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`${name} is not set`);
    return v;
  }

  private mapStatus(status: string | undefined): GetTrackingResult["status"] {
    switch (status?.toLowerCase()) {
      case "pending":
        return "pending";
      case "picked":
      case "picked_up":
        return "picked";
      case "in_transit":
      case "in_delivery":
        return "in_transit";
      case "delivered":
        return "delivered";
      case "failed":
      case "cancelled":
        return "failed";
      default:
        return "pending";
    }
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

export function createJumiaProvider(): LogisticsProvider {
  return new JumiaLogisticsProvider();
}
