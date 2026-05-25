#!/usr/bin/env node

import "dotenv/config.js";

const token = process.env.SENDBOX_ACCESS_TOKEN;

console.log("=".repeat(80));
console.log("TESTING SENDBOX SANDBOX VS LIVE");
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

const endpoints = [
  {
    name: "SANDBOX",
    url: "https://sandbox.staging.sendbox.co/shipping/shipments/delivery_quote",
  },
  {
    name: "LIVE",
    url: "https://live.sendbox.co/shipping/shipments/delivery_quote",
  },
];

console.log(`\nToken: ${token.substring(0, 50)}...`);
console.log(`Token Length: ${token.length}\n`);

for (const endpoint of endpoints) {
  console.log("-".repeat(80));
  console.log(`Testing: ${endpoint.name}`);
  console.log(`URL: ${endpoint.url}\n`);

  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    const statusText = response.statusText || `HTTP ${response.status}`;

    console.log(`Status: ${response.status} ${statusText}`);

    if (responseText) {
      try {
        const json = JSON.parse(responseText);
        console.log("Response:", JSON.stringify(json, null, 2));
      } catch {
        console.log("Response:", responseText.substring(0, 200));
      }
    }

    if (response.ok) {
      console.log(`✅ SUCCESS - ${endpoint.name} works!`);
    } else if (response.status === 401) {
      console.log(`⚠️  AUTH ERROR - Token invalid on ${endpoint.name}`);
    } else if (response.status === 404) {
      console.log(`❌ NOT FOUND - ${endpoint.name} endpoint doesn't exist`);
    }
  } catch (error) {
    console.error("❌ Request failed:", error.message);
  }

  console.log();
}

console.log("=".repeat(80));
console.log("INTERPRETATION:");
console.log("=".repeat(80));
console.log(`
If SANDBOX returns 200: 
  → Your token works, but live account has issues
  → Live account may not be activated (KYC pending)
  → Contact Sendbox support to activate live API

If SANDBOX returns 401:
  → Token itself is invalid or expired
  → Regenerate token in Sendbox Dashboard
  
If both return 401:
  → Try regenerating token first
  → If still fails, contact Sendbox support
`);
