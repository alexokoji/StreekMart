# Korapay Setup Guide (Correct Version)

## Quick Setup

### 1. Get Your API Keys from Korapay

**Dashboard → Settings → API Configuration**

You'll see:
```
Public Key:      pk_test_xxxxx  (or pk_live_ in production)
Secret Key:      sk_test_xxxxx  (or sk_live_ in production)
Encryption Key:  (optional)
```

### 2. Add to `.env.local`

```bash
KORAPAY_LIVE=0                      # 0 for testing, 1 for production
KORAPAY_PUBLIC_KEY=pk_test_xxxxx
KORAPAY_SECRET_KEY=sk_test_xxxxx   # This is also your webhook signing key
KORAPAY_BASE_URL=https://api.korapay.com
```

### 3. Set Webhook URL in Korapay Dashboard

**Dashboard → Settings → API Configuration → Notification URL**

Enter:
```
https://yourdomain.com/api/korapay/webhook
```

(Development: use ngrok to expose localhost)

### 4. Done!

That's it. No separate webhook secret needed.

---

## How Webhook Signing Works

**Korapay sends:**
```json
POST /api/korapay/webhook
Header: x-korapay-signature: {signature}
Body: {
  "event": "charge.success",
  "data": {
    "reference": "ABC123",
    "amount": 100,
    "status": "success"
  }
}
```

**Your server verifies:**
```javascript
const crypto = require("crypto");
const secretKey = process.env.KORAPAY_SECRET_KEY; // sk_test_xxx

// Sign ONLY the data object (not full body)
const hash = crypto
  .createHmac("sha256", secretKey)
  .update(JSON.stringify(body.data))
  .digest("hex");

// Compare with header
if (hash === req.headers["x-korapay-signature"]) {
  // ✓ Signature is valid
} else {
  // ✗ Signature is invalid, reject
}
```

**Key Point**: Use your `KORAPAY_SECRET_KEY` (sk_test_ or sk_live_) as the webhook signing secret. No separate webhook secret.

---

## Environment Variables

### Development (Testing)

```bash
KORAPAY_LIVE=0
KORAPAY_PUBLIC_KEY=pk_test_xxxxx
KORAPAY_SECRET_KEY=sk_test_xxxxx
```

Get these from: **Korapay Dashboard → Settings → API Configuration**

### Production (Live)

```bash
KORAPAY_LIVE=1
KORAPAY_PUBLIC_KEY=pk_live_xxxxx
KORAPAY_SECRET_KEY=sk_live_xxxxx
```

After your KYC is approved, Korapay will give you live keys (pk_live_ and sk_live_). Switch them out.

---

## Testing with ngrok

### Setup

```bash
# Terminal 1: Expose localhost to internet
ngrok http 3000
# Output: https://abc123.ngrok.io

# Terminal 2: Update .env.local
NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io

# Korapay Dashboard: Set webhook URL
# Settings → API Configuration → Notification URL
# https://abc123.ngrok.io/api/korapay/webhook
```

### Test Payment Flow

1. Add product to cart
2. Go to checkout
3. Click "Pay with Korapay"
4. You'll see the Korapay checkout (or stub in test mode)
5. Complete payment
6. Korapay POSTs webhook to your ngrok URL
7. Your server verifies signature and processes payment
8. Order status changes to PAID

---

## Webhook Events

Korapay sends these events:

| Event | When | What to do |
|-------|------|-----------|
| `charge.success` | ✓ Payment completed | Process payment, move order to PAID |
| `charge.failed` | ✗ Payment failed | Cancel order, notify buyer |
| `transfer.success` | ✓ Payout sent | Credit seller wallet |
| `transfer.failed` | ✗ Payout failed | Notify seller |
| `refund.success` | ✓ Refund processed | Credit buyer, update order |
| `refund.failed` | ✗ Refund failed | Notify support |

For checkout, you primarily handle: **`charge.success`**

---

## Common Mistakes

❌ **Wrong**: Using a separate "webhook secret"
- Korapay doesn't have one
- Use your API secret key (sk_test_ or sk_live_)

❌ **Wrong**: Signing the full request body
- Only sign `body.data` object
- Full body includes other fields

❌ **Wrong**: Not returning HTTP 200
- Must return 200 to acknowledge receipt
- If you don't, Korapay retries for 72 hours
- Can cause duplicate order processing

❌ **Wrong**: Processing webhook before verifying signature
- Always verify signature first
- Prevents processing spoofed webhooks

✓ **Right**: Use `KORAPAY_SECRET_KEY` for both API auth and webhook verification

---

## Implementation Checklist

- [ ] Got `pk_test_` and `sk_test_` from Korapay dashboard
- [ ] Added to `.env.local`
- [ ] Set webhook URL in Korapay dashboard to `{your_url}/api/korapay/webhook`
- [ ] Test payment flow (add to cart → checkout → pay)
- [ ] Webhook handler verifies signature using `sk_test_`
- [ ] Order moves to PAID after successful payment
- [ ] Ready to test shipments and tracking

---

## Production Readiness

When you go live:

1. **Get production keys** from Korapay (after KYC approval)
   - `pk_live_xxxxx`
   - `sk_live_xxxxx`

2. **Update `.env` (production)**
   ```bash
   KORAPAY_LIVE=1
   KORAPAY_PUBLIC_KEY=pk_live_xxxxx
   KORAPAY_SECRET_KEY=sk_live_xxxxx
   ```

3. **Update webhook URL** in Korapay dashboard
   ```
   https://yourdomain.com/api/korapay/webhook
   ```

4. **Test in production**
   - Process a test transaction
   - Verify webhook is received and signed correctly
   - Order status updated to PAID

---

## Getting Help

**Korapay Documentation**: https://korapay.com/docs

**Dashboard Access**: https://merchant.korapay.com

**Common Issues**:
- **"Webhook not being called"** → Check URL in dashboard, make sure it's publicly accessible
- **"Signature verification failed"** → Using `sk_test_`, signing only `body.data`?
- **"Duplicate orders"** → Not returning 200? Korapay retries for 72 hours

---

That's it! Simple and straightforward. 🚀
