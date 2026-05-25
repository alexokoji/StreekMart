#!/usr/bin/env node

import "dotenv/config.js";

const token = process.env.SENDBOX_ACCESS_TOKEN;
const baseUrl = process.env.SENDBOX_BASE_URL || "https://live.sendbox.co";

console.log("=".repeat(80));
console.log("TESTING CORRECT PAYLOAD FORMAT");
console.log("=".repeat(80));

if (!token) {
  console.error("❌ Error: SENDBOX_ACCESS_TOKEN not set");
  process.exit(1);
}

console.log(`\nToken: ${token.substring(0, 50)}...`);
console.log(`Base URL: ${baseUrl}`);
console.log(`Endpoint: ${baseUrl}/shipping/shipments/delivery_quote\n`);

// Correct payload with all required fields
const payload = {
  origin: {
    address: "123 Seller Street",
    city: "Lagos",
    state: "Lagos",
    postal_code: "100001",
    country: "NG",
    phone: "+234800000000",
  },
  destination: {
    address: "456 Buyer Avenue",
    city: "Abuja",
    state: "FCT",
    postal_code: "900001",
    country: "NG",
    phone: "+234800000001",
  },
  package: {
    weight: 1,
    value: 0,
  },
  currency: "NGN",
  region: "NG",
};

console.log("Request Payload:");
console.log(JSON.stringify(payload, null, 2));
console.log("\n" + "-".repeat(80) + "\n");

try {
  const response = await fetch(
    `${baseUrl}/shipping/shipments/delivery_quote`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token, // Raw token, no Bearer prefix
      },
      body: JSON.stringify(payload),
    }
  );

  const responseText = await response.text();
  const statusText = response.statusText || `HTTP ${response.status}`;

  console.log(`Response Status: ${response.status} ${statusText}`);

  if (responseText) {
    try {
      const json = JSON.parse(responseText);
      
      if (json.couriers) {
        console.log("\n✅ SUCCESS! Got courier options:\n");
        console.log(JSON.stringify(json, null, 2));
      } else if (json.data && Array.isArray(json.data)) {
        console.log("\n✅ SUCCESS! Got shipping rates:\n");
        console.log(JSON.stringify(json, null, 2));
      } else {
        console.log("\nResponse:");
        console.log(JSON.stringify(json, null, 2));
      }
    } catch {
      console.log("Response:");
      console.log(responseText);
    }
  } else {
    console.log("(no response body)");
  }
} catch (error) {
  console.error("❌ Request failed:", error.message);
}
