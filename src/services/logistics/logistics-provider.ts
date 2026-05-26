import {
  GetRatesInput,
  NormalizedRateResponse,
  CreateShipmentInput,
  CreateShipmentResult,
  TrackingUpdate,
} from "./logistics.types";

export interface LogisticsProvider {
  getName(): "SHIPBUBBLE" | "KWIK";
  getShippingRates(input: GetRatesInput): Promise<NormalizedRateResponse[]>;
  createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult>;
  getTracking(externalId: string, trackingCode?: string): Promise<TrackingUpdate[]>;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
}
