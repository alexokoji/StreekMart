export interface AddressDetails {
  name?: string;
  phone?: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
  // Optional structured fields produced by the Google Places picker. When
  // present we prefer formattedAddress for Shipbubble validation and use
  // placeId as the stable cache key for the resolved address_code.
  formattedAddress?: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
}

export interface GetRatesInput {
  pickupAddress: AddressDetails;
  deliveryAddress: AddressDetails;
  weight?: number; // kg
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  value?: number; // in NGN cents
  description?: string;
}

export interface NormalizedRateResponse {
  id: string; // Courier/Service ID
  name: string; // Courier Name
  provider: "SHIPBUBBLE" | "KWIK";
  price: number; // Cost in NGN cents
  estimatedDays: number;
  eta: string; // Estimated delivery date/time string
  courierCode: string;
  trackingLevel: string; // e.g. "high", "medium", "low"
  isCODAvailable: boolean;
}

export interface CreateShipmentInput {
  orderId: string;
  pickupAddress: AddressDetails;
  deliveryAddress: AddressDetails;
  courierId?: string; // chosen courier rate id
  courierCode?: string; // chosen courier service code
  weight?: number; // kg
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  value?: number; // NGN cents
  description?: string;
}

export interface CreateShipmentResult {
  externalId: string; // Provider's shipment/task ID
  trackingCode: string; // Waybill/Tracking number
  courierName?: string;
  courierId?: string;
  labelUrl?: string;
  receiptUrl?: string;
  estimatedDelivery?: Date;
  shippingFeeCents?: number;
  requestToken?: string;
}

export interface TrackingUpdate {
  status: "pending" | "picked" | "in_transit" | "out_for_delivery" | "delivered" | "failed" | "cancelled";
  lastUpdate: Date;
  currentLocation?: string;
  message?: string;
  rawStatus?: string;
}
