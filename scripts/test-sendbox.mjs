#!/usr/bin/env node
/**
 * Sendbox Smoke Test
 * Tests authentication, endpoint paths, and payload format
 */

import dotenv from "dotenv";
dotenv.config();

const BASE_URL = process.env.SENDBOX_BASE_URL || "https://live.sendbox.co";
const ACCESS_TOKEN = process.env.SENDBOX_ACCESS_TOKEN;
const IS_LIVE = process.env.SENDBOX_LIVE === "1";

console.log("=".repeat(60));
console.log("SENDBOX SMOKE TEST");
console.log("=".repeat(60));

// 1. Check environment variables
console.log("\n1. ENVIRONMENT VARIABLES CHECK");
console.log("-".repeat(60));
console.log(`SENDBOX_LIVE: ${IS_LIVE}`);
console.log(`SENDBOX_BASE_URL: ${BASE_URL}`);
console.log(`SENDBOX_ACCESS_TOKEN exists: ${!!ACCESS_TOKEN}`);
if (ACCESS_TOKEN) {
  console.log(`  - Token length: ${ACCESS_TOKEN.length}`);
  console.log(`  - Token prefix: ${ACCESS_TOKEN.substring(0, 20)}...`);
  console.log(`  - Starts with 'eyJ': ${ACCESS_TOKEN.startsWith("eyJ")}`);
} else {
  console.log("  ⚠️ WARNING: SENDBOX_ACCESS_TOKEN not set!");
}

if (!IS_LIVE) {
  console.log("\n⚠️ SENDBOX_LIVE=0 (stub mode) - Skipping live API test");
  process.exit(0);
}

// 2. Test Authorization Header
console.log("\n2. AUTHORIZATION HEADER CHECK");
console.log("-".repeat(60));
const authHeader = `Bearer ${ACCESS_TOKEN}`;
console.log(`Authorization: ${authHeader.substring(0, 40)}...`);
console.log(`Header format valid: ${authHeader.startsWith("Bearer eyJ")}`);

// 3. Test Rates Endpoint
console.log("\n3. RATES ENDPOINT TEST");
console.log("-".repeat(60));

const ratesPayload = {
  origin: {
    address: "123 Seller Street",
    city: "Lagos",
    state: "Lagos",
    postal_code: "100001",
  },
  destination: {
    address: "456 Buyer Avenue",
    city: "Abuja",
    state: "FCT",
    postal_code: "900001",
  },
  package: {
    weight: 1,
    value: 0,
  },
};

console.log(`Endpoint: POST ${BASE_URL}/api/v1/shipping/quote`);
console.log("Payload:", JSON.stringify(ratesPayload, null, 2));

fetch(`${BASE_URL}/api/v1/shipping/quote`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${ACCESS_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  body: JSON.stringify(ratesPayload),
})
  .then(async (response) => {
    const text = await response.text();
    console.log(`\nResponse Status: ${response.status} ${response.statusText}`);
    console.log(`Response Headers:`, Object.fromEntries(response.headers));
    console.log(`Response Body:\n${text}`);

    if (!response.ok) {
      console.log("\n❌ FAILED - Authentication or API error");
      process.exit(1);
    }

    try {
      const data = JSON.parse(text);
      console.log(`\n✅ SUCCESS - API is responding`);
      console.log(`Response has 'couriers': ${!!data.couriers}`);
      if (data.couriers) {
        console.log(`Number of courier options: ${data.couriers.length}`);
        data.couriers.forEach((c, i) => {
          console.log(`  ${i + 1}. ${c.name || c.code} - ${c.price || "N/A"}`);
        });
      }
    } catch (e) {
      console.log(`\n⚠️ Response is not valid JSON: ${e.message}`);
    }

    process.exit(0);
  })
  .catch((err) => {
    console.log("\n❌ NETWORK ERROR");
    console.log(`Error: ${err.message}`);
    process.exit(1);
  });
