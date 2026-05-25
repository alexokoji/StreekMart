#!/usr/bin/env node

import "dotenv/config.js";

const token = process.env.SENDBOX_ACCESS_TOKEN;
const baseUrl = process.env.SENDBOX_BASE_URL || "https://live.sendbox.co";

console.log("=".repeat(80));
console.log("TESTING ALTERNATIVE RATE ENDPOINTS");
console.log("=".repeat(80));

if (!token) {
  console.error("❌ Error: SENDBOX_ACCESS_TOKEN not set");
  process.exit(1);
}

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

const endpoints = [
  { name: "delivery_quote", path: "/shipping/shipments/delivery_quote" },
  { name: "rates", path: "/shipping/shipments/rates" },
  { name: "quote", path: "/shipping/quote" },
  { name: "rates (alternative)", path: "/shipping/rates" },
  { name: "quotes", path: "/shipping/quotes" },
];

console.log(`\nToken: ${token.substring(0, 50)}...`);
console.log(`\nTesting ${endpoints.length} different endpoints:\n`);

for (const endpoint of endpoints) {
  try {
    const response = await fetch(`${baseUrl}${endpoint.path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    const statusText = response.statusText || `HTTP ${response.status}`;

    let result = "";
    if (response.ok) {
      try {
        const json = JSON.parse(responseText);
        if (json.couriers || json.data || json.rates) {
          result = "✅ SUCCESS - Got rates!";
        } else {
          result = "⚠️  OK response but unexpected format";
        }
      } catch {
        result = "⚠️  OK but not JSON";
      }
    } else if (response.status === 409) {
      result = "⚠️  409 Conflict (record not found)";
    } else if (response.status === 401) {
      result = "❌ 401 Auth failed";
    } else if (response.status === 404) {
      result = "❌ 404 Not found";
    } else {
      result = `⚠️  ${response.status}`;
    }

    console.log(`${endpoint.name.padEnd(20)} → ${result}`);
  } catch (error) {
    console.log(`${endpoint.name.padEnd(20)} → ❌ ${error.message}`);
  }
}

console.log("\n" + "=".repeat(80));
