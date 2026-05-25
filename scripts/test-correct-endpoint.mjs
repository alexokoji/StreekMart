#!/usr/bin/env node

import "dotenv/config.js";

const token = process.env.SENDBOX_ACCESS_TOKEN;
const baseUrl = process.env.SENDBOX_BASE_URL || "https://live.sendbox.co";

console.log("=".repeat(80));
console.log("TESTING CORRECT SENDBOX ENDPOINT: /shipping/shipments/delivery_quote");
console.log("=".repeat(80));

if (!token) {
  console.error("❌ Error: SENDBOX_ACCESS_TOKEN not set");
  process.exit(1);
}

console.log(`\nToken: ${token.substring(0, 50)}...`);
console.log(`Base URL: ${baseUrl}`);
console.log(`Full URL: ${baseUrl}/shipping/shipments/delivery_quote\n`);

const payload = {
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
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }
  );

  const statusText = response.statusText || `HTTP ${response.status}`;
  const responseText = await response.text();

  console.log(`Response Status: ${response.status} ${statusText}`);
  console.log("\nResponse Headers:");
  for (const [key, value] of response.headers.entries()) {
    console.log(`  ${key}: ${value}`);
  }

  console.log("\nResponse Body:");
  if (responseText) {
    try {
      const json = JSON.parse(responseText);
      console.log(JSON.stringify(json, null, 2));
    } catch {
      console.log(responseText);
    }
  } else {
    console.log("(empty)");
  }

  if (response.ok) {
    console.log("\n✅ SUCCESS");
  } else if (response.status === 401) {
    console.log("\n⚠️  AUTHORIZATION ERROR (401)");
    console.log("Your token might be:");
    console.log("  1. Expired or regenerated in Sendbox Dashboard");
    console.log("  2. Wrong environment (live token with sandbox URL)");
    console.log("  3. Account not activated for live API");
    console.log("\nAction: Check Sendbox Dashboard → Regenerate Token");
  } else if (response.status === 404) {
    console.log("\n❌ ENDPOINT NOT FOUND (404)");
    console.log("The endpoint path may still be incorrect.");
  } else {
    console.log("\n❌ ERROR");
  }
} catch (error) {
  console.error("❌ Request failed:", error.message);
}
