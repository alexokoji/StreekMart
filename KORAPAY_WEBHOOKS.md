# Korapay Webhook Setup Guide

## Official Korapay Webhook Specification

Based on Korapay's documentation, here's the exact webhook behavior you need to know:

### Webhook URL Configuration
1. Go to your **Korapay Merchant Dashboard**
2. Navigate to **API Configuration** or **Settings**
3. Find the **Webhook URL** section
4. Enter: `https://yourdomain.com/api/korapay/webhook`
5. **Important**: Webhook URL must be unauthenticated and publicly available

### What Happens
- Korapay sends webhook notifications as **HTTP POST** requests
- Notifications are sent in **real-time** as transactions progress
- You receive **one webhook per event**
- Events: `charge.success`, `charge.failed`, `transfer.success`, `transfer.failed`, `refund.success`, `refund.failed`

### Webhook Payload Structure
```json
{
  "event": "charge.success",
  "data": {
    "amount": 150.99,
    "fee": 15,
    "currency": "NGN",
    "status": "success",
    "reference": "Z78EYMAUBQ5"
  }
}
```

**Field Definitions:**
- `event` (string): Transaction event type
- `data.amount` (number): Transaction amount
- `data.fee` (number): Transaction fee charged
- `data.currency` (string): Currency code (NGN, etc.)
- `data.status` (string): `success` or `failed`
- `data.reference` (string): Unique transaction reference for tracking

### Signature Verification (IMPORTANT!)

**Header**: `x-korapay-signature` (lowercase)

**Signature is**: HMAC-SHA256 of **ONLY the data object** (not the entire request body)

**Key**: Your `KORAPAY_SECRET_KEY`

**Verification Logic**:
```javascript
const crypto = require("crypto");
const secretKey = process.env.KORAPAY_SECRET_KEY; // Your secret key

// Webhook arrives with:
// - Header: x-korapay-signature (the signature to verify)
// - Body: { event, data }

const hash = crypto
  .createHmac("sha256", secretKey)
  .update(JSON.stringify(data))  // ← ONLY the data object!
  .digest("hex");

if (hash === req.headers["x-korapay-signature"]) {
  // Webhook is authentic ✓
} else {
  // Webhook is spoofed, reject ✗
}
```

### Responding to Webhooks

**You MUST respond with HTTP 200 status code** to acknowledge receipt.

```javascript
// ✓ Correct
res.status(200).json({ status: "ok" });

// ✗ Wrong (will trigger retries)
res.status(500).json({ error: "..." });
```

**Why HTTP 200 matters**:
- Korapay retries failed webhooks for up to **72 hours**
- If you don't return 200, Korapay will keep retrying
- Too many retries can cause duplicate order processing
- Always return 200 immediately, process order logic after

### Webhook Retry Behavior

If Korapay doesn't receive a **200 status code** or request times out:
- Korapay automatically retries the webhook
- Retries continue for up to **72 hours**
- Retry frequency increases over time
- After 72 hours, Korapay stops retrying

**Important**: You must handle duplicate notifications! If the same reference arrives twice, only process it once.

### Best Practices

1. **Verify signature** before processing
2. **Return 200 immediately** (before heavy processing)
3. **Check for duplicates** (track processed references)
4. **Log all webhooks** for debugging
5. **Don't timeout** (keep response time < 30s)

### Testing Webhooks Locally

Use **ngrok** to expose localhost to the internet:

```bash
# Terminal 1: Start ngrok
ngrok http 3000
# Output: Forwarding https://abc123.ngrok.io -> http://localhost:3000

# Terminal 2: Update .env.local
NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io

# In Korapay Dashboard
# Webhook URL: https://abc123.ngrok.io/api/korapay/webhook

# Korapay Dashboard → Test webhook delivery
# Should see webhook hit your local server
```

### Webhook Events Reference

| Event | When | Action |
|-------|------|--------|
| `charge.success` | ✓ Payment successful | Move order to PAID |
| `charge.failed` | ✗ Payment failed | Cancel order |
| `transfer.success` | ✓ Payout sent | Credit seller wallet |
| `transfer.failed` | ✗ Payout failed | Notify seller |
| `refund.success` | ✓ Refund processed | Credit buyer wallet |
| `refund.failed` | ✗ Refund failed | Notify support |

For checkout flow, you primarily handle: **`charge.success`** (payment confirmed)

### Implementation in UpClo

Our webhook handler (`/api/korapay/webhook`):
```typescript
1. Parse webhook body
2. Extract data object
3. Verify x-korapay-signature header
4. Check event === "charge.success"
5. Find orders by data.reference
6. Update orders with paymentGateway="KORAPAY"
7. Call finalizePaidOrders(reference)
8. Return 200 to acknowledge
```

### Troubleshooting

**Webhook not being called?**
- [ ] Webhook URL configured in Korapay dashboard
- [ ] URL is publicly accessible (test with curl)
- [ ] No authentication required on the endpoint
- [ ] Firewall/security allows incoming POST requests

**"Webhook signature verification failed"?**
- [ ] Signature verified against `KORAPAY_SECRET_KEY` (not webhook secret)
- [ ] Signature is of `data` object only (not entire body)
- [ ] Header name is lowercase: `x-korapay-signature`
- [ ] Using HMAC-SHA256, not other algorithms

**Duplicate orders being created?**
- [ ] Track which references you've processed
- [ ] Don't process same reference twice
- [ ] Return 200 immediately to prevent retries
- [ ] Consider idempotency keys

**Getting timeout errors?**
- [ ] Process webhook too slowly?
- [ ] Return 200 FIRST, process order logic after
- [ ] Check for blocking I/O operations
- [ ] Add timeout handling in database queries

### Webhook Signature Verification Code

```typescript
// Correct implementation per Korapay spec
const crypto = require("node:crypto");

export async function POST(req: Request) {
  const rawBody = await req.text();
  const body = JSON.parse(rawBody);
  const headerSignature = req.headers.get("x-korapay-signature");

  const secretKey = process.env.KORAPAY_SECRET_KEY;
  
  // Sign ONLY the data object
  const expectedSignature = crypto
    .createHmac("sha256", secretKey)
    .update(JSON.stringify(body.data))  // ← Only data!
    .digest("hex");

  // Verify
  if (expectedSignature === headerSignature) {
    // Process webhook
    const { event, data } = body;
    if (event === "charge.success") {
      await finalizePaidOrders(data.reference);
    }
  }

  // IMPORTANT: Always return 200
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
```

### Production Checklist

- [ ] Webhook URL configured in Korapay dashboard
- [ ] Using production `KORAPAY_SECRET_KEY` (not test key)
- [ ] URL is publicly accessible over HTTPS
- [ ] Signature verification enabled
- [ ] Returning 200 status code immediately
- [ ] Logging all webhook events
- [ ] Monitoring for duplicate references
- [ ] Handling timeouts gracefully
- [ ] Testing with Korapay's webhook test tool
- [ ] Monitoring dashboard for failed webhook deliveries

---

**Questions?** See the Korapay Merchant Dashboard documentation or contact Korapay support.
