import { LogisticsProvider } from "./logistics-provider";
import {
  GetRatesInput,
  NormalizedRateResponse,
  CreateShipmentInput,
  CreateShipmentResult,
  TrackingUpdate,
} from "./logistics.types";
import { cleanPhone } from "./logistics.mapper";

export class KwikService implements LogisticsProvider {
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;
  private isEnabled: boolean;
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor() {
    this.clientId = process.env.KWIK_CLIENT_ID || "";
    this.clientSecret = process.env.KWIK_CLIENT_SECRET || "";
    this.baseUrl = process.env.KWIK_BASE_URL || "https://api.kwik.delivery/v1";
    this.isEnabled = process.env.KWIK_ENABLED === "1" || process.env.KWIK_ENABLED === "true";
  }

  getName(): "SHIPBUBBLE" | "KWIK" {
    return "KWIK";
  }

  private isStubMode(): boolean {
    return !this.isEnabled || !this.clientId || !this.clientSecret;
  }

  /**
   * OAuth Token Retrieval
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > Date.now()) {
      return this.accessToken;
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: "client_credentials",
        }),
      });

      if (!response.ok) {
        throw new Error(`Kwik OAuth failed: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      // Expire 1 minute early to be safe
      this.tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000 - 60000;

      return this.accessToken!;
    } catch (err) {
      console.error("[Kwik] Authentication error:", err);
      throw err;
    }
  }

  private async getHeaders() {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Fetch estimated pricing for Kwik motorcycle delivery.
   */
  async getShippingRates(input: GetRatesInput): Promise<NormalizedRateResponse[]> {
    if (this.isStubMode()) {
      return this.getStubRates(input);
    }

    try {
      const headers = await this.getHeaders();
      const payload = {
        pickup: {
          address: input.pickupAddress.address,
          city: input.pickupAddress.city,
          state: input.pickupAddress.state,
          country: input.pickupAddress.country || "NG",
          phone: cleanPhone(input.pickupAddress.phone),
        },
        delivery: {
          address: input.deliveryAddress.address,
          city: input.deliveryAddress.city,
          state: input.deliveryAddress.state,
          country: input.deliveryAddress.country || "NG",
          phone: cleanPhone(input.deliveryAddress.phone),
        },
        package: {
          weight: input.weight || 0.2,
          description: input.description || "StreekMart Package",
        },
        vehicle_type: "bike", // Primary vehicle for e-commerce deliveries
      };

      const response = await fetch(`${this.baseUrl}/tasks/price`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Kwik pricing failed: ${response.status} - ${text}`);
      }

      const json = await response.json();
      const priceVal = parseFloat(json.data?.price || json.data?.amount || "0");

      return [
        {
          id: "kwik_bike_delivery",
          name: "Kwik Instant Delivery (Motorcycle)",
          provider: "KWIK",
          price: Math.round(priceVal * 100), // NGN to cents
          estimatedDays: 1, // Kwik is instant/same-day
          eta: "Same Day (1-3 hours)",
          courierCode: "bike",
          trackingLevel: "high", // Kwik provides live GPS tracking link
          isCODAvailable: false,
        },
      ];
    } catch (err) {
      console.error("[Kwik] Failed to get shipping rates:", err);
      throw err;
    }
  }

  /**
   * Create a delivery task.
   */
  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    if (this.isStubMode()) {
      return this.getStubCreateShipment(input);
    }

    try {
      const headers = await this.getHeaders();
      const payload = {
        pickup: {
          name: input.pickupAddress.name || "StreekMart Seller",
          address: input.pickupAddress.address,
          city: input.pickupAddress.city,
          state: input.pickupAddress.state,
          country: input.pickupAddress.country || "NG",
          phone: cleanPhone(input.pickupAddress.phone),
        },
        delivery: {
          name: input.deliveryAddress.name || "Buyer",
          address: input.deliveryAddress.address,
          city: input.deliveryAddress.city,
          state: input.deliveryAddress.state,
          country: input.deliveryAddress.country || "NG",
          phone: cleanPhone(input.deliveryAddress.phone),
        },
        package: {
          weight: input.weight || 0.2,
          description: input.description || "StreekMart Item",
        },
        vehicle_type: "bike",
        payment_method: "corporate_wallet", // Booked against merchant's corporate balance
      };

      const response = await fetch(`${this.baseUrl}/tasks`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Kwik task booking failed: ${response.status} - ${text}`);
      }

      const json = await response.json();
      const data = json.data;

      return {
        externalId: String(data.task_id || data.id),
        trackingCode: data.tracking_number || data.tracking_code || `KWIK-${data.task_id}`,
        courierName: "Kwik Motorcycle",
        courierId: "kwik_bike_delivery",
        labelUrl: data.tracking_url || data.label_url, // Kwik shares live tracking links
        receiptUrl: data.receipt_url || data.invoice_url,
        estimatedDelivery: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
        shippingFeeCents: data.price ? Math.round(parseFloat(data.price) * 100) : undefined,
      };
    } catch (err) {
      console.error("[Kwik] Failed to book task:", err);
      throw err;
    }
  }

  /**
   * Track Kwik task status.
   */
  async getTracking(externalId: string, trackingCode?: string): Promise<TrackingUpdate[]> {
    if (this.isStubMode()) {
      return this.getStubTracking(externalId);
    }

    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseUrl}/tasks/${externalId}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`Kwik tracking failed: ${response.statusText}`);
      }

      const json = await response.json();
      const task = json.data;

      const statusMap: Record<string, TrackingUpdate["status"]> = {
        pending: "pending",
        assigned: "pending",
        accepted: "pending",
        arrived_at_pickup: "picked",
        picked_up: "picked",
        in_transit: "in_transit",
        arrived_at_delivery: "out_for_delivery",
        delivered: "delivered",
        failed: "failed",
        cancelled: "cancelled",
      };

      // Construct a single status update based on the current task status
      return [
        {
          status: statusMap[task.status?.toLowerCase()] || "in_transit",
          lastUpdate: new Date(task.updated_at || Date.now()),
          currentLocation: task.current_location || "",
          message: task.rider_details
            ? `Rider ${task.rider_details.name} (${task.rider_details.phone}) is handling: ${task.status}`
            : `Task status: ${task.status}`,
          rawStatus: task.status,
        },
      ];
    } catch (err) {
      console.error("[Kwik] Tracking failed:", err);
      throw err;
    }
  }

  /**
   * Webhook Signature Verification.
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    // Kwik uses a header token, client secret verification, or raw headers
    const secret = process.env.KWIK_WEBHOOK_SECRET || this.clientSecret;
    if (!secret || this.isStubMode()) {
      return true;
    }

    const crypto = require("crypto");
    const hash = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    return hash === signature;
  }

  // ==================== STUB MOCK RESPONSES ====================

  private getStubRates(input: GetRatesInput): NormalizedRateResponse[] {
    return [
      {
        id: "kwik_stub_bike",
        name: "Kwik Instant Delivery (Motorcycle)",
        provider: "KWIK",
        price: 150000, // 1500 NGN
        estimatedDays: 1,
        eta: "Same Day (1-2 hours)",
        courierCode: "bike",
        trackingLevel: "high",
        isCODAvailable: false,
      },
    ];
  }

  private getStubCreateShipment(input: CreateShipmentInput): CreateShipmentResult {
    const taskId = `KWIK-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    return {
      externalId: taskId,
      trackingCode: taskId,
      courierName: "Kwik Motorcycle",
      courierId: "kwik_stub_bike",
      labelUrl: `https://kwik.delivery/track/${taskId}`,
      receiptUrl: `https://kwik.delivery/receipts/${taskId}.pdf`,
      estimatedDelivery: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
      shippingFeeCents: 150000,
    };
  }

  private getStubTracking(externalId: string): TrackingUpdate[] {
    return [
      {
        status: "in_transit",
        lastUpdate: new Date(),
        currentLocation: "On the move, Lagos",
        message: "Kwik Rider is in transit to buyer address.",
        rawStatus: "in_transit",
      },
    ];
  }
}
