#!/usr/bin/env node

import "dotenv/config.js";

const token = process.env.SENDBOX_ACCESS_TOKEN;
const baseUrl = process.env.SENDBOX_BASE_URL || "https://live.sendbox.co";

console.log("=".repeat(80));
console.log("TESTING WITH COMPLETE SHIPMENT DATA");
console.log("=".repeat(80));

if (!token) {
  console.error("❌ Error: SENDBOX_ACCESS_TOKEN not set");
  process.exit(1);
}

const payload = {
  origin: {
    name: "StreekMart Seller",
    phone: "+234800000000",
    email: "seller@streekmart.online",
    address: "123 Seller Street",
    city: "Lagos",
    state: "Lagos",
    postal_code: "100001",
    country: "NG",
  },
  destination: {
    name: "John Doe",
    phone: "+234800000001",
    email: "buyer@example.com",
    address: "456 Buyer Avenue",
    city: "Abuja",
    state: "FCT",
    postal_code: "900001",
    country: "NG",
  },
  package: {
    weight: 1.5,
    height: 10,
    width: 10,
    length: 10,
    value: 5000,
    description: "Clothing item",
  },
  currency: "NGN",
  region: "NG",
};

console.log(`\nToken: ${token.substring(0, 50)}...`);
console.log(`\nRequest Payload:`);
console.log(JSON.stringify(payload, null, 2));
console.log("\n" + "-".repeat(80) + "\n");

try {
  const response = await fetch(
    `${baseUrl}/shipping/shipments/delivery_quote`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify(payload),
    }
  );

  const responseText = await response.text();
  const statusText = response.statusText || `HTTP ${response.status}`;

  console.log(`Response Status: ${response.status} ${statusText}`);
  console.log("\nResponse Body:");
  
  if (responseText) {
    try {
      const json = JSON.parse(responseText);
      console.log(JSON.stringify(json, null, 2));
      
      if (json.couriers || json.data) {
        console.log("\n✅ SUCCESS! Received shipping options!");
      }
    } catch {
      console.log(responseText);
    }
  }
} catch (error) {
  console.error("❌ Request failed:", error.message);
}
