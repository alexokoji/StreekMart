import { prisma } from "@/lib/db";
import { LogisticsProvider } from "./logistics-provider";
import {
  GetRatesInput,
  NormalizedRateResponse,
  CreateShipmentInput,
  CreateShipmentResult,
  TrackingUpdate,
  AddressDetails,
} from "./logistics.types";
import { cleanPhone, getAddressKey, extractDaysFromText } from "./logistics.mapper";

export class ShipbubbleService implements LogisticsProvider {
  private apiKey: string;
  private baseUrl: string;
  private isEnabled: boolean;

  constructor() {
    this.apiKey = process.env.SHIPBUBBLE_API_KEY || "";
    this.baseUrl = process.env.SHIPBUBBLE_BASE_URL || "https://api.shipbubble.com/v1";
    this.isEnabled = process.env.SHIPBUBBLE_ENABLED === "1" || process.env.SHIPBUBBLE_ENABLED === "true";
  }

  getName(): "SHIPBUBBLE" | "KWIK" {
    return "SHIPBUBBLE";
  }

  private isStubMode(): boolean {
    return !this.isEnabled || !this.apiKey;
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Resolve a raw address into a Shipbubble address code.
   * Utilizes the `ShipbubbleAddressCode` cache table.
   */
  async getOrCreateAddressCode(addr: AddressDetails): Promise<string> {
    const addressKey = getAddressKey(addr);

    // 1. Check local cache first
    const cached = await prisma.shipbubbleAddressCode.findUnique({
      where: { addressKey },
    });

    if (cached) {
      console.log(`[Shipbubble] Cache hit for address key: ${addressKey} -> ${cached.addressCode}`);
      return cached.addressCode;
    }

    // 2. If stub mode, generate a fake address code
    if (this.isStubMode()) {
      const stubCode = `ADDR_SB_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      await prisma.shipbubbleAddressCode.create({
        data: { addressKey, addressCode: stubCode },
      });
      return stubCode;
    }

    // 3. Request address code from Shipbubble API
    try {
      console.log(`[Shipbubble] Cache miss, creating address code on API for: ${addr.city}, ${addr.state}`);
      const payload = {
        name: addr.name || "StreekMart Contact",
        email: addr.email || "contact@streekmart.com",
        phone: cleanPhone(addr.phone),
        street: addr.address,
        city: addr.city,
        state: addr.state,
        country: addr.country || "NG",
        postal_code: addr.postalCode || "",
      };

      const response = await fetch(`${this.baseUrl}/shipping/address`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Address creation failed: ${response.status} - ${text}`);
      }

      const resBody = await response.json();
      const code = resBody.data?.address_code || resBody.data?.code || resBody.data?.id;

      if (!code) {
        throw new Error("Address code not returned in API response");
      }

      // Save to cache
      await prisma.shipbubbleAddressCode.create({
        data: { addressKey, addressCode: code },
      });

      return code;
    } catch (err) {
      console.error("[Shipbubble] Address creation error:", err);
      throw err;
    }
  }

  /**
   * Fetch shipping rates.
   */
  async getShippingRates(input: GetRatesInput): Promise<NormalizedRateResponse[]> {
    if (this.isStubMode()) {
      return this.getStubRates(input);
    }

    try {
      const senderCode = await this.getOrCreateAddressCode(input.pickupAddress);
      const recipientCode = await this.getOrCreateAddressCode(input.deliveryAddress);

      // Default dimensions and weight
      const weight = input.weight ?? parseFloat(process.env.DEFAULT_PACKAGE_WEIGHT || "0.2");
      const length = input.dimensions?.length ?? parseFloat(process.env.DEFAULT_PACKAGE_LENGTH || "10");
      const width = input.dimensions?.width ?? parseFloat(process.env.DEFAULT_PACKAGE_WIDTH || "10");
      const height = input.dimensions?.height ?? parseFloat(process.env.DEFAULT_PACKAGE_HEIGHT || "10");
      const value = input.value ?? parseFloat(process.env.DEFAULT_PACKAGE_VALUE || "1000");

      const payload = {
        sender_address_code: senderCode,
        recipient_address_code: recipientCode,
        package: {
          weight,
          length,
          width,
          height,
          value,
        },
      };

      const response = await fetch(`${this.baseUrl}/shipping/rates`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Rates request failed: ${response.status} - ${text}`);
      }

      const json = await response.json();
      const rawRates = json.data?.rates || json.data || [];

      // Map rates to normalized format
      const normalized: NormalizedRateResponse[] = rawRates.map((rate: any) => {
        const totalAmount = parseFloat(rate.total_amount || rate.amount || rate.price || "0");
        return {
          id: String(rate.courier_id || rate.id),
          name: rate.courier_name || rate.name || "Standard Courier",
          provider: "SHIPBUBBLE",
          price: Math.round(totalAmount * 100), // NGN to cents
          estimatedDays: extractDaysFromText(rate.delivery_eta || rate.eta || "3 days"),
          eta: rate.delivery_eta || rate.eta || "3-5 business days",
          courierCode: rate.courier_code || rate.code || "",
          trackingLevel: rate.tracking_level || "medium",
          isCODAvailable: !!rate.is_cod_available,
        };
      });

      // Filter out expensive premium couriers (DHL/FedEx) unless explicitly asked (default filter)
      // Standard flow avoids DHL/FedEx premium routes
      const filtered = normalized.filter((rate) => {
        const name = rate.name.toLowerCase();
        const code = rate.courierCode.toLowerCase();
        const isPremium = name.includes("dhl") || name.includes("fedex") || code.includes("dhl") || code.includes("fedex");
        return !isPremium;
      });

      return filtered.length > 0 ? filtered : normalized;
    } catch (err) {
      console.error("[Shipbubble] Failed to get shipping rates:", err);
      throw err;
    }
  }

  /**
   * Create a shipment booking.
   */
  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    if (this.isStubMode()) {
      return this.getStubCreateShipment(input);
    }

    try {
      const senderCode = await this.getOrCreateAddressCode(input.pickupAddress);
      const recipientCode = await this.getOrCreateAddressCode(input.deliveryAddress);

      const weight = input.weight ?? parseFloat(process.env.DEFAULT_PACKAGE_WEIGHT || "0.2");
      const length = input.dimensions?.length ?? parseFloat(process.env.DEFAULT_PACKAGE_LENGTH || "10");
      const width = input.dimensions?.width ?? parseFloat(process.env.DEFAULT_PACKAGE_WIDTH || "10");
      const height = input.dimensions?.height ?? parseFloat(process.env.DEFAULT_PACKAGE_HEIGHT || "10");
      const value = input.value ?? parseFloat(process.env.DEFAULT_PACKAGE_VALUE || "1000");

      const payload = {
        sender_address_code: senderCode,
        recipient_address_code: recipientCode,
        courier_id: input.courierId,
        courier_code: input.courierCode,
        package: {
          weight,
          length,
          width,
          height,
          value,
        },
        description: input.description || "StreekMart Order",
        cod: process.env.ENABLE_COD === "1",
        insurance: process.env.ENABLE_INSURANCE === "1",
      };

      const response = await fetch(`${this.baseUrl}/shipping/shipments`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Shipment creation failed: ${response.status} - ${text}`);
      }

      const json = await response.json();
      const data = json.data;

      return {
        externalId: String(data.shipment_id || data.id),
        trackingCode: data.tracking_code || data.waybill || data.tracking_number,
        courierName: data.courier_name,
        courierId: input.courierId,
        labelUrl: data.label_url,
        receiptUrl: data.receipt_url || data.invoice_url,
        estimatedDelivery: data.estimated_delivery ? new Date(data.estimated_delivery) : undefined,
        shippingFeeCents: data.total_amount ? Math.round(parseFloat(data.total_amount) * 100) : undefined,
        requestToken: data.request_token,
      };
    } catch (err) {
      console.error("[Shipbubble] Failed to create shipment:", err);
      throw err;
    }
  }

  /**
   * Fetch tracking history.
   */
  async getTracking(externalId: string, trackingCode?: string): Promise<TrackingUpdate[]> {
    if (this.isStubMode()) {
      return this.getStubTracking(externalId);
    }

    try {
      const identifier = trackingCode || externalId;
      const response = await fetch(`${this.baseUrl}/shipping/track/${identifier}`, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Tracking request failed: ${response.statusText}`);
      }

      const json = await response.json();
      const history = json.data?.history || json.data?.updates || [];

      const statusMap: Record<string, TrackingUpdate["status"]> = {
        pending: "pending",
        picked: "picked",
        picked_up: "picked",
        in_transit: "in_transit",
        transit: "in_transit",
        out_for_delivery: "out_for_delivery",
        delivered: "delivered",
        failed: "failed",
        cancelled: "cancelled",
      };

      return history.map((item: any) => ({
        status: statusMap[item.status?.toLowerCase()] || "in_transit",
        lastUpdate: new Date(item.created_at || item.timestamp || Date.now()),
        currentLocation: item.location || "",
        message: item.message || item.description || "",
        rawStatus: item.status,
      }));
    } catch (err) {
      console.error("[Shipbubble] Failed to fetch tracking:", err);
      throw err;
    }
  }

  /**
   * Schedule carrier pickup.
   */
  async schedulePickup(input: {
    shipmentId: string;
    pickupDate: string; // YYYY-MM-DD
    pickupTime?: string;
  }): Promise<boolean> {
    if (this.isStubMode()) {
      return true;
    }

    try {
      const response = await fetch(`${this.baseUrl}/shipping/pickup`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          shipment_id: input.shipmentId,
          pickup_date: input.pickupDate,
          pickup_time: input.pickupTime || "10:00:00",
        }),
      });

      return response.ok;
    } catch (err) {
      console.error("[Shipbubble] Failed to schedule pickup:", err);
      return false;
    }
  }

  /**
   * Verify webhook signature.
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const secret = process.env.SHIPBUBBLE_WEBHOOK_SECRET || "";
    if (!secret || this.isStubMode()) {
      return true; // Don't block requests in dev
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
        id: "sb_stub_gigl",
        name: "GIG Logistics (Shipbubble)",
        provider: "SHIPBUBBLE",
        price: 220000, // 2200 NGN
        estimatedDays: 3,
        eta: "3 business days",
        courierCode: "gigl",
        trackingLevel: "high",
        isCODAvailable: false,
      },
      {
        id: "sb_stub_redstar",
        name: "Red Star Express (Shipbubble)",
        provider: "SHIPBUBBLE",
        price: 280000, // 2800 NGN
        estimatedDays: 2,
        eta: "2 business days",
        courierCode: "redstar",
        trackingLevel: "high",
        isCODAvailable: true,
      },
      {
        id: "sb_stub_speedaf",
        name: "Speedaf Express (Shipbubble)",
        provider: "SHIPBUBBLE",
        price: 180000, // 1800 NGN
        estimatedDays: 4,
        eta: "4 business days",
        courierCode: "speedaf",
        trackingLevel: "medium",
        isCODAvailable: false,
      },
    ];
  }

  private getStubCreateShipment(input: CreateShipmentInput): CreateShipmentResult {
    const trackingCode = `SB-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const externalId = `SBX-${Date.now()}`;

    return {
      externalId,
      trackingCode,
      courierName: input.courierCode || "GIG Logistics",
      courierId: input.courierId || "sb_stub_gigl",
      labelUrl: `https://shipbubble.com/labels/${externalId}.pdf`,
      receiptUrl: `https://shipbubble.com/receipts/${externalId}.pdf`,
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      shippingFeeCents: 220000,
      requestToken: `TOKEN_${Date.now()}`,
    };
  }

  private getStubTracking(externalId: string): TrackingUpdate[] {
    return [
      {
        status: "pending",
        lastUpdate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        currentLocation: "Lagos Hub",
        message: "Shipment registered with GIG Logistics",
      },
      {
        status: "picked",
        lastUpdate: new Date(Date.now() - 12 * 60 * 60 * 1000),
        currentLocation: "Lagos Hub",
        message: "Item collected by courier rider",
      },
      {
        status: "in_transit",
        lastUpdate: new Date(),
        currentLocation: "Transit Warehouse, Ikeja",
        message: "Package is on its way to destination hub",
      },
    ];
  }
}
