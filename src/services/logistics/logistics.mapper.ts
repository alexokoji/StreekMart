import { AddressDetails, NormalizedRateResponse } from "./logistics.types";

/**
 * Clean phone numbers to ensure they conform to Nigerian format:
 * Remove "+234", "234", and ensure it starts with a single "0".
 */
export function cleanPhone(phone?: string): string {
  if (!phone) return "08000000000";
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, "");
  
  if (digitsOnly.startsWith("234") && digitsOnly.length > 10) {
    return "0" + digitsOnly.slice(3);
  }
  if (digitsOnly.startsWith("0")) {
    return digitsOnly;
  }
  return "0" + digitsOnly;
}

/**
 * Generate a consistent address key for database caching.
 *
 * When a Google Place ID is present we key the cache by placeId + contact
 * (name/phone/email) because Shipbubble bakes the contact into the validated
 * address record. Falling back to address fields preserves cache hits for
 * legacy free-text addresses.
 */
export function getAddressKey(addr: AddressDetails): string {
  if (addr.placeId) {
    return [
      "placeId",
      addr.placeId,
      addr.name || "",
      addr.phone ? cleanPhone(addr.phone) : "",
      addr.email || "",
    ]
      .map((str) => str.trim().toLowerCase())
      .join("|");
  }
  return [
    addr.name || "",
    addr.phone ? cleanPhone(addr.phone) : "",
    addr.email || "",
    addr.address,
    addr.city,
    addr.state,
    addr.country,
    addr.postalCode || "",
  ]
    .map((str) => str.trim().toLowerCase())
    .join("|");
}

/**
 * Extract numerical days from a text expression (e.g. "3 - 5 business days", "Delivery in 2 days").
 */
export function extractDaysFromText(text: string): number {
  const match = text.match(/(\d+)\s*-\s*(\d+)/);
  if (match) {
    return Math.ceil((parseInt(match[1]) + parseInt(match[2])) / 2);
  }
  const singleMatch = text.match(/(\d+)/);
  if (singleMatch) {
    return parseInt(singleMatch[1]);
  }
  return 3; // Default fallback
}
