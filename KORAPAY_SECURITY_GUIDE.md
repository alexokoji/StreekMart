# Korapay Integration Security & Encryption Guide

## Overview

This guide clarifies the encryption and security requirements for Korapay integration.

---

## Korapay Credentials

### Required
- **`KORAPAY_PUBLIC_KEY`** — Merchant identifier (non-sensitive, can be public)
- **`KORAPAY_SECRET_KEY`** — API authentication key (sensitive, keep secret)
  - Used in `Authorization: Bearer {SECRET_KEY}` header for all API calls

### Optional
- **`KORAPAY_ENCRYPTION_KEY`** — Request/response encryption key
  - **Status**: Only required if Korapay API version requires payload encryption
  - **Check**: Ask Korapay support or see merchant dashboard settings
  - **If not used**: Set to empty string or omit from `.env.local`
  - **Implementation**: Currently optional; added as `X-Korapay-Encryption-Key` header if present

- **`KORAPAY_WEBHOOK_SECRET`** — Webhook signature verification secret
  - **Status**: Required in production for webhook security
  - **Used for**: Verifying `X-Korapay-Signature` header on incoming webhooks
  - **Algorithm**: HMAC-SHA256
  - **How to obtain**: From Korapay merchant dashboard → Webhook settings

---

## Do I Need an Encryption Key?

### Modern Korapay API (v2, v3)
**Answer: Probably not.**

Modern payment APIs like Korapay use:
- ✅ HTTPS for transport encryption (automatic)
- ✅ Bearer token authentication (already implemented)
- ✅ HMAC-SHA256 webhook signatures (already implemented)

Request-level encryption is rarely required.

### Legacy/Custom Korapay Implementations
**Answer: Check Korapay documentation.**

If your Korapay setup requires encryption:
1. Get `KORAPAY_ENCRYPTION_KEY` from merchant dashboard
2. Add to `.env.local`:
   ```bash
   KORAPAY_ENCRYPTION_KEY=your_encryption_key_here
   ```
3. The adapter will automatically include it in request headers

---

## How Korapay Integration Works

### 1. Authentication
```
Request Header:
  Authorization: Bearer {KORAPAY_SECRET_KEY}
  Content-Type: application/json
  X-Korapay-Encryption-Key: {KORAPAY_ENCRYPTION_KEY} [if set]
```

### 2. Webhook Verification
```
Korapay sends webhook with header:
  X-Korapay-Signature: {HMAC-SHA256(raw_body, KORAPAY_WEBHOOK_SECRET)}

UpClo verifies:
  compute = HMAC-SHA256(raw_body, KORAPAY_WEBHOOK_SECRET)
  if compute == X-Korapay-Signature → Accept webhook
  else → Reject (401 Unauthorized)
```

### 3. Request Flow (Checkout)
```
Client clicks "Pay"
  ↓
POST /api/cart/checkout
  ↓
getGatewaySelector() → tries Korapay first
  ↓
KorapayGateway.initCheckout()
  ├─ Create request payload
  ├─ Add headers: Authorization, optional Encryption-Key
  ├─ POST https://api.korapay.com/merchant/transactions/initialize
  └─ Receive: checkout_url + transaction_id
  ↓
Return checkout_url to client
  ↓
Client redirects to Korapay checkout page
  ↓
Customer completes payment
  ↓
Korapay POSTs webhook to /api/korapay/webhook
  ├─ Verify signature with KORAPAY_WEBHOOK_SECRET
  ├─ Extract reference + status
  └─ Call finalizePaidOrders() → Move order to PAID
```

---

## Security Checklist

### Development Environment
- [ ] `KORAPAY_LIVE=0` (stub mode, no real calls)
- [ ] Mock credentials OK (can be fake/test values)
- [ ] Webhook secret not needed in stub mode

### Production Environment
- [ ] `KORAPAY_LIVE=1` (real API calls)
- [ ] Real `KORAPAY_PUBLIC_KEY` from dashboard
- [ ] Real `KORAPAY_SECRET_KEY` from dashboard (keep secret!)
- [ ] Real `KORAPAY_WEBHOOK_SECRET` from dashboard
- [ ] `KORAPAY_ENCRYPTION_KEY` only if Korapay requires it
- [ ] HTTPS enforced (automatic in production)
- [ ] Webhook secret stored in secure config, not in code
- [ ] Test webhook delivery in Korapay merchant dashboard

---

## Environment Variable Template

```bash
# Development
KORAPAY_LIVE=0
KORAPAY_PUBLIC_KEY=test_pk_12345
KORAPAY_SECRET_KEY=test_sk_67890
KORAPAY_ENCRYPTION_KEY=          # Optional, leave empty if not needed
KORAPAY_WEBHOOK_SECRET=          # Not needed in stub mode

# Production
KORAPAY_LIVE=1
KORAPAY_PUBLIC_KEY=live_pk_xxxxxx
KORAPAY_SECRET_KEY=live_sk_xxxxxx # KEEP THIS SECRET!
KORAPAY_ENCRYPTION_KEY=          # Only if required by Korapay
KORAPAY_WEBHOOK_SECRET=live_wh_xxxxxx  # From merchant dashboard
```

---

## Determining if You Need Encryption Key

### Contact Korapay Support
Ask: *"Does my integration require request/response encryption via `X-Korapay-Encryption-Key` header?"*

### Check Merchant Dashboard
1. Log into Korapay merchant portal
2. Go to Settings → API Keys / Webhooks
3. Look for "Encryption" or "Request Signing" section
4. If present and marked "required" → You need the key

### Try Without (Recommended)
1. Set `KORAPAY_ENCRYPTION_KEY=""` (empty)
2. Test checkout flow
3. If error message mentions encryption/signature → Contact Korapay
4. Add key to .env.local if needed

---

## Webhook Security

### Why Signature Verification Matters
Webhook signatures prevent **replay attacks** and **spoofing**:
- Without verification: Anyone can fake a "payment successful" webhook
- With verification: Only Korapay (who knows the secret) can create valid signatures

### How It Works
```
Korapay generates signature:
  raw_body = JSON stringified webhook payload
  signature = HMAC-SHA256(raw_body, KORAPAY_WEBHOOK_SECRET)
  Sends: X-Korapay-Signature: {signature}

UpClo verifies:
  raw_body = read request body as raw text (before JSON parsing)
  computed_sig = HMAC-SHA256(raw_body, KORAPAY_WEBHOOK_SECRET)
  if computed_sig == X-Korapay-Signature:
    ✓ Webhook is authentic
  else:
    ✗ Webhook is spoofed, reject (401)
```

### Production Requirements
- **Always verify webhook signatures in production**
- Disable verification only in development (for testing)
- Store webhook secret in `KORAPAY_WEBHOOK_SECRET` env var
- Never commit webhook secret to code

---

## Troubleshooting

### Error: "Korapay init failed: 401 Unauthorized"
**Cause**: Invalid `KORAPAY_SECRET_KEY`
**Fix**: 
1. Copy exact key from merchant dashboard
2. Paste into `.env.local` 
3. Restart dev server
4. Retry

### Error: "Webhook signature verification failed"
**Cause**: Invalid `KORAPAY_WEBHOOK_SECRET` or webhook not configured
**Fix**:
1. In production: Copy webhook secret from merchant dashboard
2. Add to `.env.local`: `KORAPAY_WEBHOOK_SECRET=...`
3. Configure webhook URL in merchant dashboard: `{your_domain}/api/korapay/webhook`
4. Test webhook delivery from dashboard

### Error: "Encryption key not found"
**Cause**: Korapay requires encryption but key not set
**Fix**:
1. Ask Korapay support if encryption is required
2. Get `KORAPAY_ENCRYPTION_KEY` from merchant dashboard
3. Add to `.env.local`: `KORAPAY_ENCRYPTION_KEY=...`
4. Restart server

### Webhook not being called
**Cause**: Endpoint not registered or webhook not configured in dashboard
**Check**:
1. Route exists: `POST /api/korapay/webhook` 
2. Reachable from internet (test with curl if possible)
3. Configured in Korapay merchant dashboard: Settings → Webhooks
4. Test webhook delivery from dashboard manually

---

## Next Steps

1. **Get credentials from Korapay merchant dashboard**
2. **Ask support**: "Do I need KORAPAY_ENCRYPTION_KEY?"
3. **Fill in `.env.local`**:
   ```bash
   KORAPAY_LIVE=0                    # 1 when ready for production
   KORAPAY_PUBLIC_KEY=your_pk
   KORAPAY_SECRET_KEY=your_sk
   KORAPAY_ENCRYPTION_KEY=           # Leave empty unless required
   KORAPAY_WEBHOOK_SECRET=your_wh    # From dashboard
   ```
4. **Test checkout** (see INTEGRATION_GUIDE.md)
5. **Configure webhook** in Korapay dashboard
6. **Test webhook** in merchant dashboard (send test event)

---

## Summary

| Variable | Required | Where from | Security |
|----------|----------|-----------|----------|
| `KORAPAY_PUBLIC_KEY` | Yes | Merchant dashboard | Non-sensitive, can be public |
| `KORAPAY_SECRET_KEY` | Yes | Merchant dashboard | 🔒 SECRET! Never commit |
| `KORAPAY_ENCRYPTION_KEY` | Maybe* | Merchant dashboard | 🔒 If required; keep secret |
| `KORAPAY_WEBHOOK_SECRET` | Yes (prod) | Merchant dashboard → Webhooks | 🔒 SECRET! For webhook verification |

*Check with Korapay if required for your integration.
