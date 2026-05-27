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
   * Build a single-line address string suitable for Shipbubble's Google Places-backed
   * /shipping/address/validate endpoint. The API does NOT accept split city/state/postal fields.
   * When the caller already has a Google-formatted address (from the checkout picker), use it
   * verbatim — that's exactly what Shipbubble's validator expects.
   */
  private buildAddressString(addr: AddressDetails): string {
    if (addr.formattedAddress && addr.formattedAddress.trim()) {
      return addr.formattedAddress.trim();
    }
    const parts = [addr.address, addr.city, addr.state, addr.postalCode, addr.country]
      .map((p) => (p || "").toString().trim())
      .filter(Boolean);
    // De-duplicate adjacent identical parts (addr.address often already contains city/state)
    const deduped: string[] = [];
    for (const p of parts) {
      if (!deduped.length || deduped[deduped.length - 1].toLowerCase() !== p.toLowerCase()) {
        deduped.push(p);
      }
    }
    return deduped.join(", ");
  }

  /**
   * Resolve a raw address into a Shipbubble address code via POST /shipping/address/validate.
   * Utilizes the `ShipbubbleAddressCode` cache table.
   */
  async getOrCreateAddressCode(addr: AddressDetails): Promise<string> {
    const addressKey = getAddressKey(addr);

    const cached = await prisma.shipbubbleAddressCode.findUnique({
      where: { addressKey },
    });

    if (cached) {
      console.log(`[Shipbubble] Cache hit for address key: ${addressKey} -> ${cached.addressCode}`);
      return cached.addressCode;
    }

    if (this.isStubMode()) {
      const stubCode = `ADDR_SB_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      await prisma.shipbubbleAddressCode.create({
        data: { addressKey, addressCode: stubCode },
      });
      return stubCode;
    }

    try {
      console.log(`[Shipbubble] Cache miss, validating address: ${addr.city}, ${addr.state}`);
      const payload = {
        name: addr.name || "StreekMart Contact",
        email: addr.email || "contact@streekmart.com",
        phone: cleanPhone(addr.phone),
        address: this.buildAddressString(addr),
      };

      const response = await fetch(`${this.baseUrl}/shipping/address/validate`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Address validation failed: ${response.status} - ${text}`);
      }

      const resBody = await response.json();
      const rawCode = resBody.data?.address_code ?? resBody.data?.code ?? resBody.data?.id;

      if (rawCode === undefined || rawCode === null) {
        throw new Error("Address code not returned in API response");
      }

      const code = String(rawCode);

      await prisma.shipbubbleAddressCode.create({
        data: { addressKey, addressCode: code },
      });

      return code;
    } catch (err) {
      console.error("[Shipbubble] Address validation error:", err);
      throw err;
    }
  }

  /**
   * Build a single-item package_items array from the GetRatesInput fields.
   * Shipbubble requires at least one item with name/description/unit_weight/unit_amount/quantity.
   */
  private buildPackageItems(input: GetRatesInput | CreateShipmentInput) {
    const weight = input.weight ?? parseFloat(process.env.DEFAULT_PACKAGE_WEIGHT || "0.2");
    // input.value is documented as NGN cents in logistics.types, so convert to NGN units for Shipbubble
    const valueNgn = input.value !== undefined
      ? Math.max(1, Math.round(input.value / 100))
      : parseFloat(process.env.DEFAULT_PACKAGE_VALUE || "1000");
    const name = (input as CreateShipmentInput).description || input.description || "Order item";
    return [
      {
        name,
        description: name,
        unit_weight: String(weight),
        unit_amount: String(valueNgn),
        quantity: "1",
      },
    ];
  }

  private buildPackageDimension(input: GetRatesInput | CreateShipmentInput) {
    return {
      length: input.dimensions?.length ?? parseFloat(process.env.DEFAULT_PACKAGE_LENGTH || "10"),
      width: input.dimensions?.width ?? parseFloat(process.env.DEFAULT_PACKAGE_WIDTH || "10"),
      height: input.dimensions?.height ?? parseFloat(process.env.DEFAULT_PACKAGE_HEIGHT || "10"),
    };
  }

  private getDefaultCategoryId(): number {
    const raw = process.env.SHIPBUBBLE_DEFAULT_CATEGORY_ID;
    const parsed = raw ? parseInt(raw, 10) : NaN;
    // Shipbubble requires a real category_id from GET /shipping/labels/categories.
    // Caller must set SHIPBUBBLE_DEFAULT_CATEGORY_ID; fallback is a common "General" id.
    return Number.isFinite(parsed) ? parsed : 99;
  }

  private todayDateString(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  /**
   * Internal: hit /shipping/fetch_rates and return the raw response data including request_token.
   */
  private async fetchRatesRaw(input: GetRatesInput): Promise<{
    couriers: any[];
    requestToken: string;
  }> {
    const senderCode = await this.getOrCreateAddressCode(input.pickupAddress);
    const recipientCode = await this.getOrCreateAddressCode(input.deliveryAddress);

    const payload = {
      sender_address_code: senderCode,
      // Shipbubble's API uses the misspelling "reciever_address_code" — preserve it.
      reciever_address_code: recipientCode,
      pickup_date: this.todayDateString(),
      category_id: this.getDefaultCategoryId(),
      package_items: this.buildPackageItems(input),
      package_dimension: this.buildPackageDimension(input),
    };

    const response = await fetch(`${this.baseUrl}/shipping/fetch_rates`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Rates request failed: ${response.status} - ${text}`);
    }

    const json = await response.json();
    const couriers: any[] = json.data?.couriers || json.data?.rates || [];
    const requestToken: string = json.data?.request_token || "";
    return { couriers, requestToken };
  }

  /**
   * Fetch shipping rates via POST /shipping/fetch_rates.
   */
  async getShippingRates(input: GetRatesInput): Promise<NormalizedRateResponse[]> {
    if (this.isStubMode()) {
      return this.getStubRates(input);
    }

    try {
      const { couriers } = await this.fetchRatesRaw(input);

      const normalized: NormalizedRateResponse[] = couriers.map((rate: any) => {
        const totalAmount = parseFloat(rate.total ?? rate.total_amount ?? rate.amount ?? rate.price ?? "0");
        return {
          id: String(rate.courier_id || rate.id),
          name: rate.courier_name || rate.name || "Standard Courier",
          provider: "SHIPBUBBLE",
          price: Math.round(totalAmount * 100), // NGN -> cents
          estimatedDays: extractDaysFromText(rate.delivery_eta || rate.eta || "3 days"),
          eta: rate.delivery_eta || rate.eta || "3-5 business days",
          courierCode: rate.service_code || rate.courier_code || rate.code || "",
          trackingLevel: String(rate.tracking_level ?? "medium"),
          isCODAvailable: !!rate.is_cod_available,
        };
      });

      // Filter out premium couriers (DHL/FedEx) by default
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
   * Create a shipment booking via POST /shipping/labels.
   *
   * Shipbubble requires a fresh `request_token` from `/shipping/fetch_rates` paired with
   * the chosen `service_code` (+ optionally `courier_id`). We re-fetch rates here, pick
   * the courier matching the caller's chosen `courierId` / `courierCode`, then post the
   * label. The token from the rates call is single-use, so callers must NOT pass a stale
   * one in.
   */
  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    if (this.isStubMode()) {
      return this.getStubCreateShipment(input);
    }

    try {
      const { couriers, requestToken } = await this.fetchRatesRaw({
        pickupAddress: input.pickupAddress,
        deliveryAddress: input.deliveryAddress,
        weight: input.weight,
        dimensions: input.dimensions,
        value: input.value,
        description: input.description,
      });

      if (!requestToken) {
        throw new Error("Shipbubble fetch_rates did not return a request_token");
      }

      const chosen = couriers.find((c: any) => {
        const idMatch = input.courierId && String(c.courier_id) === String(input.courierId);
        const codeMatch =
          input.courierCode &&
          (c.service_code === input.courierCode || c.courier_code === input.courierCode);
        return idMatch || codeMatch;
      }) || couriers[0];

      if (!chosen) {
        throw new Error("No courier available for this route");
      }

      const payload = {
        request_token: requestToken,
        service_code: chosen.service_code || chosen.courier_code || input.courierCode,
        courier_id: chosen.courier_id || input.courierId,
      };

      const response = await fetch(`${this.baseUrl}/shipping/labels`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Shipment creation failed: ${response.status} - ${text}`);
      }

      const json = await response.json();
      const data = json.data || {};
      const totalFee = data.payment?.total ?? data.payment?.shipping_fee ?? data.total_amount;

      return {
        externalId: String(data.order_id || data.shipment_id || data.id),
        trackingCode: data.tracking_number || data.tracking_code || data.waybill || "",
        courierName: data.courier_name || chosen.courier_name,
        courierId: String(chosen.courier_id || input.courierId || ""),
        labelUrl: data.label_url,
        receiptUrl: data.receipt_url || data.invoice_url,
        estimatedDelivery: data.delivery_eta_time
          ? new Date(data.delivery_eta_time)
          : data.estimated_delivery
          ? new Date(data.estimated_delivery)
          : undefined,
        shippingFeeCents: totalFee !== undefined ? Math.round(parseFloat(String(totalFee)) * 100) : undefined,
        requestToken,
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
      const orderId = externalId || trackingCode;
      const response = await fetch(`${this.baseUrl}/shipping/labels/track/${orderId}`, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Tracking request failed: ${response.status} - ${text}`);
      }

      const json = await response.json();
      const trackingInfo = json.data?.tracking_info ?? json.data ?? {};
      const events: any[] = trackingInfo.events || trackingInfo.history || trackingInfo.updates || [];

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

      return events.map((item: any) => {
        const raw = String(item.event_status ?? item.status ?? "").toLowerCase();
        return {
          status: statusMap[raw] || "in_transit",
          lastUpdate: new Date(item.event_date || item.created_at || item.timestamp || Date.now()),
          currentLocation: item.location || "",
          message: item.description || item.message || "",
          rawStatus: item.event_status ?? item.status,
        };
      });
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
