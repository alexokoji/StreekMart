#!/usr/bin/env node

import "dotenv/config.js";

const token = process.env.SENDBOX_ACCESS_TOKEN;
const baseUrl = process.env.SENDBOX_BASE_URL || "https://live.sendbox.co";

console.log("=".repeat(80));
console.log("TESTING DIFFERENT AUTH HEADER FORMATS");
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

const authFormats = [
  { name: "Bearer Token", header: `Bearer ${token}` },
  { name: "Raw Token", header: token },
  { name: "x-api-key", header: null, customHeader: { "x-api-key": token } },
];

console.log(`\nToken: ${token.substring(0, 50)}...`);
console.log(`Base URL: ${baseUrl}\n`);

for (const format of authFormats) {
  console.log("-".repeat(80));
  console.log(`Testing: ${format.name}`);

  try {
    const headers = {
      "Content-Type": "application/json",
    };

    if (format.customHeader) {
      Object.assign(headers, format.customHeader);
      console.log(`Header: x-api-key: ${token.substring(0, 30)}...`);
    } else {
      headers.Authorization = format.header;
      console.log(`Header: Authorization: ${format.header.substring(0, 40)}...`);
    }

    const response = await fetch(
      `${baseUrl}/shipping/shipments/delivery_quote`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }
    );

    const responseText = await response.text();
    const statusText = response.statusText || `HTTP ${response.status}`;

    console.log(`Status: ${response.status} ${statusText}`);

    if (responseText) {
      try {
        const json = JSON.parse(responseText);
        if (json.couriers || json.data || json.rates) {
          console.log("✅ SUCCESS - Got courier options!");
          console.log(JSON.stringify(json, null, 2));
        } else {
          console.log("Response:", JSON.stringify(json, null, 2).substring(0, 300));
        }
      } catch {
        console.log("Response:", responseText.substring(0, 200));
      }
    }

    if (response.ok) {
      console.log(`✅ This format works!`);
    } else if (response.status === 401) {
      console.log(`❌ Auth rejected`);
    }
  } catch (error) {
    console.error("❌ Request failed:", error.message);
  }

  console.log();
}

console.log("=".repeat(80));
console.log("SUMMARY");
console.log("=".repeat(80));
console.log(`
If Bearer works: Your integration is correct
If Raw Token works: Update code to remove Bearer prefix
If x-api-key works: Use different header name
If all fail: Sendbox account may not be activated for live API
          → Contact Sendbox support to verify account status
`);
