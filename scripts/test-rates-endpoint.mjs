#!/usr/bin/env node
/**
 * Test the /api/logistics/rates endpoint locally or remotely
 * This simulates what the CheckoutForm sends during checkout
 */

const baseUrl = process.argv[2] || "http://localhost:3000";

const testPayload = {
  provider: "SENDBOX",
  pickupCity: "Lagos",
  pickupState: "Lagos",
  pickupCountry: "NG",
  deliveryCity: "Abuja",
  deliveryState: "FCT",
  deliveryCountry: "NG",
  description: "Order from UpClo",
};

console.log(`Testing POST ${baseUrl}/api/logistics/rates`);
console.log("Payload:", JSON.stringify(testPayload, null, 2));

fetch(`${baseUrl}/api/logistics/rates`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(testPayload),
})
  .then((r) => r.json())
  .then((data) => {
    console.log("Response:", JSON.stringify(data, null, 2));
  })
  .catch((err) => {
    console.error("Error:", err.message);
  });
