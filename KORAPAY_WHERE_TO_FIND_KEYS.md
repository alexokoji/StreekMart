# Korapay: Where to Find Everything

## 🔑 Where to Get Your Keys

**Location**: https://merchant.korapay.com → Settings → API Configuration

You'll see three things:

```
┌─────────────────────────────────────────────────────────┐
│  API Configuration                                      │
├─────────────────────────────────────────────────────────┤
│  Public Key (pk_test_xxxxx)                             │
│  Secret Key (sk_test_xxxxx)  ← Use this for webhooks   │
│  Encryption Key (optional)                              │
└─────────────────────────────────────────────────────────┘
```

### For `.env.local`:

```bash
# From API Configuration page above:
KORAPAY_PUBLIC_KEY=pk_test_xxxxx
KORAPAY_SECRET_KEY=sk_test_xxxxx   # ← This is your webhook secret!
```

---

## 📍 Where to Set Webhook URL

**Location**: https://merchant.korapay.com → Settings → API Configuration → Notification URL

Enter your webhook endpoint:

```
https://yourdomain.com/api/korapay/webhook
```

**Important**: 
- For development: Use ngrok to expose localhost
- Must be publicly accessible (not localhost)
- No authentication required

---

## 🔐 Important: No Separate Webhook Secret

**Common misconception**: "Where's my webhook secret?"

**Answer**: You don't get one. Use your API Secret Key.

```
KORAPAY_SECRET_KEY = sk_test_xxxxx

This key is used for:
  ✓ API requests (Authorization header)
  ✓ Webhook signature verification (signing key)
```

---

## 📋 Setup Checklist

- [ ] Go to https://merchant.korapay.com
- [ ] Navigate to Settings → API Configuration
- [ ] Copy your keys:
  - [ ] `pk_test_xxxxx` → Add to `.env.local` as `KORAPAY_PUBLIC_KEY`
  - [ ] `sk_test_xxxxx` → Add to `.env.local` as `KORAPAY_SECRET_KEY`
- [ ] Scroll down to "Notification URL" field
- [ ] Enter webhook URL: `https://yourdomain.com/api/korapay/webhook`
- [ ] Save/Update
- [ ] Test with a payment

---

## .env.local Template

```bash
# Korapay Configuration
KORAPAY_LIVE=0                           # 0 = test, 1 = production
KORAPAY_PUBLIC_KEY=pk_test_xxxxx         # From API Configuration
KORAPAY_SECRET_KEY=sk_test_xxxxx         # From API Configuration (webhook signing key)
KORAPAY_BASE_URL=https://api.korapay.com
```

---

## Testing Locally (with ngrok)

```bash
# Terminal 1: Expose localhost
ngrok http 3000
# Output: Forwarding https://abc123.ngrok.io -> http://localhost:3000

# Terminal 2: Update .env.local
NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io

# Korapay Dashboard:
# Settings → API Configuration → Notification URL
# Enter: https://abc123.ngrok.io/api/korapay/webhook
```

---

## Webhook Signature Verification

```javascript
// Your webhook handler receives:
const body = {
  event: "charge.success",
  data: {
    reference: "ABC123",
    amount: 100,
    status: "success"
  }
};

const signature = req.headers["x-korapay-signature"];

// Verify using your SECRET KEY
const crypto = require("crypto");
const secretKey = process.env.KORAPAY_SECRET_KEY; // sk_test_xxxxx

const hash = crypto
  .createHmac("sha256", secretKey)
  .update(JSON.stringify(body.data))  // ← Only body.data!
  .digest("hex");

if (hash === signature) {
  // ✓ Webhook is authentic
} else {
  // ✗ Webhook is fake, reject it
}
```

---

## Production (After KYC Approval)

Once your KYC is approved, Korapay will give you live keys:

1. Go to https://merchant.korapay.com → Settings → API Configuration
2. You'll now see:
   - `pk_live_xxxxx` (instead of pk_test_)
   - `sk_live_xxxxx` (instead of sk_test_)

3. Update your production `.env`:
   ```bash
   KORAPAY_LIVE=1
   KORAPAY_PUBLIC_KEY=pk_live_xxxxx
   KORAPAY_SECRET_KEY=sk_live_xxxxx
   ```

4. Update webhook URL in dashboard to your production URL:
   ```
   https://yourdomain.com/api/korapay/webhook
   ```

---

## Summary

| Item | Where to Find | How to Use |
|------|---------------|-----------|
| **Public Key** | Korapay Dashboard → Settings → API Configuration | `KORAPAY_PUBLIC_KEY` env var |
| **Secret Key** | Korapay Dashboard → Settings → API Configuration | `KORAPAY_SECRET_KEY` env var (for API + webhook signing) |
| **Webhook Secret** | N/A — Use Secret Key | Use `KORAPAY_SECRET_KEY` for signature verification |
| **Webhook URL** | Korapay Dashboard → Settings → API Configuration → Notification URL | Set to `{your_domain}/api/korapay/webhook` |
| **Encryption Key** | Korapay Dashboard → Settings → API Configuration (optional) | Only if Korapay requires it |

---

**That's it!** You have everything you need. 🚀
