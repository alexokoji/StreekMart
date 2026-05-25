#!/usr/bin/env node
/**
 * Test /shipping/* endpoints specifically
 */

import dotenv from "dotenv";
dotenv.config();

const BASE_URL = process.env.SENDBOX_BASE_URL || "https://live.sendbox.co";
const ACCESS_TOKEN = process.env.SENDBOX_ACCESS_TOKEN;

console.log("=".repeat(70));
console.log("SENDBOX /shipping/* ENDPOINT TEST");
console.log("=".repeat(70));
console.log(`Token length: ${ACCESS_TOKEN?.length}`);
console.log(`Token starts with 'eyJ': ${ACCESS_TOKEN?.startsWith("eyJ")}`);
console.log("");

const endpoints = [
  "/shipping/quote",
  "/shipping/rates",
  "/shipping/shipments/quote",
  "/shipping/quotes",
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

async function testEndpoint(endpoint) {
  const fullUrl = `${BASE_URL}${endpoint}`;
  
  try {
    console.log(`Testing: POST ${fullUrl}`);
    
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
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (response.status === 401) {
      console.log("💡 This endpoint EXISTS but auth failed");
      console.log("   Try these steps:");
      console.log("   1. Check if token was regenerated in Sendbox Dashboard");
      console.log("   2. Verify token is not expired");
      console.log("   3. Try sandbox URL instead");
    } else if (response.status === 400) {
      console.log("✅ Endpoint exists! Got validation error (payload issue)");
      try {
        const data = JSON.parse(text);
        console.log("Response:", JSON.stringify(data, null, 2));
      } catch {
        console.log("Response:", text);
      }
    } else if (response.status === 200 || response.status === 201) {
      console.log("✅✅ SUCCESS!");
      try {
        const data = JSON.parse(text);
        console.log("Response:", JSON.stringify(data, null, 2));
      } catch {
        console.log("Response:", text);
      }
    } else {
      console.log("Response:", text.substring(0, 200));
    }
    
    console.log("");
  } catch (err) {
    console.log(`Error: ${err.message}\n`);
  }
}

(async () => {
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }
  
  console.log("=".repeat(70));
  console.log("DIAGNOSTIC SUMMARY:");
  console.log("=".repeat(70));
  console.log("\nIf /shipping/quote returns 401:");
  console.log("→ The endpoint EXISTS");
  console.log("→ But your token is not accepted");
  console.log("→ This likely means:");
  console.log("  1) Token was regenerated (you're using old token)");
  console.log("  2) Token is expired");
  console.log("  3) You're using wrong environment (live key with sandbox, etc)");
  console.log("");
  console.log("ACTION:");
  console.log("→ Go to Sendbox Dashboard");
  console.log("→ Regenerate a new Access Token");
  console.log("→ Update Vercel env vars with new token");
  console.log("→ Redeploy and test again");
})();
