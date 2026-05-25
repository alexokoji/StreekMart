#!/usr/bin/env node
/**
 * Sendbox Endpoint Discovery Test
 * Tests common Sendbox endpoint patterns to find the correct one
 */

import dotenv from "dotenv";
dotenv.config();

const BASE_URL = process.env.SENDBOX_BASE_URL || "https://live.sendbox.co";
const ACCESS_TOKEN = process.env.SENDBOX_ACCESS_TOKEN;

const endpoints = [
  "/api/v1/shipping/quote",
  "/api/v1/shipments/quote",
  "/v1/shipping/quote",
  "/shipping/quote",
  "/shipments/quote",
  "/api/shipping/quote",
  "/api/shipments/quote",
  "/api/v1/quotes",
];

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

console.log("=".repeat(70));
console.log("SENDBOX ENDPOINT DISCOVERY TEST");
console.log("=".repeat(70));
console.log(`Base URL: ${BASE_URL}`);
console.log(`Token: ${ACCESS_TOKEN?.substring(0, 30)}...`);
console.log("");

let tested = 0;
let found = false;

async function testEndpoint(endpoint) {
  tested++;
  const fullUrl = `${BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      timeout: 5000,
    });

    const text = await response.text();
    const status = response.status;
    
    // Determine if this looks promising
    let result = "❌ FAILED";
    let details = `${status}`;
    
    if (status === 200 || status === 201) {
      result = "✅ SUCCESS";
      found = true;
      try {
        const data = JSON.parse(text);
        details = `${status} - Got valid JSON response`;
        if (data.couriers) details += ` (${data.couriers.length} couriers)`;
      } catch {
        details = `${status} - Response is not JSON`;
      }
    } else if (status === 401) {
      result = "🔐 AUTH ERROR";
      details = "401 - Token might be invalid";
    } else if (status === 400) {
      result = "⚠️  BAD REQUEST";
      details = "400 - Endpoint exists but payload might be wrong";
      try {
        const data = JSON.parse(text);
        if (data.error) details += ` (${data.error})`;
      } catch {}
    } else if (status === 404) {
      result = "❌ NOT FOUND";
      details = "404 - Endpoint doesn't exist";
    } else if (status === 405) {
      result = "❌ METHOD";
      details = "405 - POST not allowed";
    }

    console.log(`${tested}. ${result} ${endpoint}`);
    console.log(`   → ${fullUrl}`);
    console.log(`   → ${details}`);
    console.log("");
    
  } catch (err) {
    console.log(`${tested}. ⚠️  ERROR ${endpoint}`);
    console.log(`   → ${err.message}`);
    console.log("");
  }
}

(async () => {
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }

  console.log("=".repeat(70));
  if (found) {
    console.log("✅ FOUND A WORKING ENDPOINT!");
  } else {
    console.log("❌ NO WORKING ENDPOINT FOUND");
    console.log("\nSuggestions:");
    console.log("1. Check Sendbox Dashboard → API Keys → Documentation");
    console.log("2. Verify you have correct token (not client secret)");
    console.log("3. Check if your account has live API access enabled");
    console.log("4. Try sandbox mode: SENDBOX_BASE_URL=https://sandbox.staging.sendbox.co");
  }
  console.log("=".repeat(70));
})();
