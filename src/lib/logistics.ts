// Logistics provider abstraction layer.
// All logistics providers implement this interface for swappable shipment handling.

export type CreateShipmentInput = {
  orderId: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  weight?: number; // kg
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  description?: string; // item description
  specialHandling?: string;
};

export type CreateShipmentResult = {
  externalId: string; // Provider's shipment ID
  trackingCode: string; // Code buyer uses to track
  labelUrl?: string; // URL to shipping label PDF
  receiptUrl?: string; // URL to receipt/invoice PDF
  estimatedDelivery?: Date;
};

export type GetTrackingInput = {
  externalId: string;
  trackingCode?: string;
};

export type TrackingUpdate = {
  status: "pending" | "picked" | "in_transit" | "delivered" | "failed";
  lastUpdate: Date;
  currentLocation?: string;
  estimatedDelivery?: Date;
  message?: string;
};

export type GetTrackingResult = {
  status: TrackingUpdate["status"];
  lastUpdate: Date;
  currentLocation?: string;
  estimatedDelivery?: Date;
  message?: string;
  labelUrl?: string;
  receiptUrl?: string;
};

export interface LogisticsProvider {
  // Create a shipment and get tracking code + label.
  createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult>;
  // Get current tracking status.
  getTracking(input: GetTrackingInput): Promise<GetTrackingResult>;
  // Get the provider name for logging/tracking.
  getName(): string;
  // Verify webhook signature (if provider sends webhooks).
  verifyWebhookSignature?(rawBody: string, headerSignature: string): boolean;
}
