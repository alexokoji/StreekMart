# Payment Gateway & Logistics Integration Guide

## Quick Setup

### 1. Database Migration
```bash
npm run db:push
# or for dev migration:
npm run db:migrate
```

### 2. Environment Configuration
Copy the new variables to `.env.local`:

```bash
# === Korapay (Payment Gateway) ===
KORAPAY_LIVE="0"  # Keep as 0 for stub mode testing
KORAPAY_PUBLIC_KEY="your_public_key_from_korapay_dashboard"
KORAPAY_SECRET_KEY="your_secret_key_from_korapay_dashboard"
# Optional encryption key (check Korapay docs if required)
KORAPAY_ENCRYPTION_KEY=""
KORAPAY_BASE_URL="https://api.korapay.com"
# Webhook secret for production (from merchant dashboard → Webhooks)
KORAPAY_WEBHOOK_SECRET=""

# === Jumia Logistics (Shipment & Tracking) ===
JUMIA_LOGISTICS_API_KEY="your_api_key_from_jumia_merchant_portal"
JUMIA_LOGISTICS_BASE_URL="https://api.jumia.co.ke/logistics/v1"
JUMIA_LOGISTICS_WEBHOOK_SECRET="your_webhook_secret"
```

**ℹ️ Security Note**: See **KORAPAY_SECURITY_GUIDE.md** for details on encryption keys and webhook secrets.

### 3. Verify Routes are Registered

Next.js auto-discovers routes. These should be available:

**Payment:**
- `POST /api/korapay/webhook` — Korapay payment confirmation webhook

**Logistics:**
- `POST /api/orders/[id]/shipping` — Create shipment (sellers)
- `GET /api/orders/[id]/shipping` — Get shipment details
- `GET /api/orders/[id]/tracking` — Get live tracking (buyers + sellers)
- `POST /api/jumia/webhook` — Jumia tracking updates webhook

---

## Testing Guide

### Test 1: Checkout with Korapay (Stub Mode)

**Setup:** Ensure `KORAPAY_LIVE=0` in .env.local

**Steps:**
1. Log in as buyer
2. Add a product to cart
3. Go to `/cart` → "Proceed to Checkout"
4. Fill shipping address + notes
5. Click "Pay with Korapay" (or whatever button text is)
6. Should redirect to `/cart/checkout?stubRef=KORAPAY_STUB_...`
7. Confirm payment (stub page will auto-finalize)
8. Verify order status changes to PAID in your account/orders

**Expected Result:** Order moves from PENDING → PAID without calling real Korapay

**Troubleshooting:**
- If still redirecting to Monnify: Check that `getGatewaySelector()` is being called in checkout route
- If error "Could not start payment": Check console for specific error; likely env var missing

---

### Test 2: Korapay Fallback (Stub → Monnify)

**Setup:** Temporarily disable Korapay

**Steps:**
1. In `.env.local`, set `KORAPAY_PUBLIC_KEY=""` (or unset it)
2. Restart dev server
3. Repeat Test 1 (add to cart, checkout, pay)
4. Should see fallback message in logs: "[Payment] Korapay init failed, falling back to Monnify"
5. Redirect should be to Monnify stub page

**Expected Result:** Fallback to Monnify works seamlessly when Korapay unavailable

---

### Test 3: Seller Creates Shipment

**Setup:** Have a PAID order from Test 1

**Steps:**
1. Log in as **seller** (the product owner)
2. Navigate to `/seller/orders/` (or your seller orders page)
3. Click on the paid order
4. Look for "Create Shipment" panel
5. Fill out:
   - Weight (kg): 1.5
   - Dimensions: 20 × 15 × 10 cm
   - Special Handling: "Fragile"
6. Click "Create Shipment"
7. Should see success message with **Tracking Code** and links to:
   - Download Shipping Label (opens label PDF)
   - Download Receipt (opens receipt from Jumia)

**Expected Result:**
- Order status changes to SHIPPED
- Shipment record created in database
- Order update posted: "Your order is on the way! Track it with code: [CODE]"

**Troubleshooting:**
- If error "Shipment already created": You already created one; refresh page
- If "Order missing shipping address": Checkout didn't capture address; retry checkout
- If Jumia API error: Check that `JUMIA_LOGISTICS_API_KEY` is set and valid
- If label/receipt URLs are empty: Jumia may not return them in stub mode; that's OK

---

### Test 4: Buyer Sees Tracking Widget

**Setup:** Have a SHIPPED order from Test 3

**Steps:**
1. Log in as **buyer** (who placed the order)
2. Go to `/account/orders/[orderId]`
3. Look for "Order Tracking" widget
4. Should display:
   - Status badge (e.g., "Pending", "In Transit")
   - Tracking code from Test 3
   - "Last Updated" timestamp
   - Optional: current location, estimated delivery
   - "View Shipping Label" link (if available)
5. Wait 30 seconds; widget should re-fetch and show "Updates every 30 seconds"

**Expected Result:** Live tracking visible to buyer with auto-refresh every 30s

**Troubleshooting:**
- If widget shows "Shipment tracking will appear once...": Order isn't SHIPPED; re-check Test 3
- If tracking shows as "cached": Real Jumia fetch failed but fallback cache works
- If 30s polling doesn't happen: Check browser console for fetch errors

---

### Test 5: Jumia Webhook (Manual Simulation)

**Setup:** Have a shipment from Test 3

**Steps:**
1. Get the shipment ID from the database or from Test 3 response
2. Send a manual webhook to `POST /api/jumia/webhook`:

```bash
curl -X POST http://localhost:3000/api/jumia/webhook \
  -H "Content-Type: application/json" \
  -H "X-Jumia-Signature: test-signature" \
  -d '{
    "shipment_id": "your_external_id_from_test_3",
    "status": "delivered",
    "current_location": "Nairobi Delivery Hub",
    "message": "Package delivered successfully"
  }'
```

**Expected Result:**
- Shipment status updates to DELIVERED
- Order status changes to COMPLETED
- New OrderUpdate created with delivery notification
- Check `/account/orders/[orderId]` — tracking widget should show "Delivered"

**Troubleshooting:**
- If signature validation fails: Webhook secret doesn't match; OK in stub mode (signature verification is optional)
- If "No shipment found": Double-check the external_id from your shipment

---

## Integration with Existing Pages

### Pages to Update (if not using components yet)

**Seller Order Detail Page**
- Import and render `<ShippingPanel orderId={orderId} orderStatus={status} onSuccess={handleShipmentCreated} />`
- Location: wherever seller views their order details

**Buyer Order Detail Page**
- Import and render `<TrackingWidget orderId={orderId} />`
- Location: wherever buyer views their order details

### Example Integration
```tsx
import { ShippingPanel } from "@/components/seller/ShippingPanel";
import { TrackingWidget } from "@/components/buyer/TrackingWidget";

// In seller order detail:
<ShippingPanel orderId={orderId} orderStatus={order.status} />

// In buyer order detail:
<TrackingWidget orderId={orderId} />
```

---

## API Reference

### POST /api/orders/[id]/shipping
**Sellers create a shipment**

Request:
```json
{
  "weight": 1.5,
  "dimensions": {
    "length": 20,
    "width": 15,
    "height": 10
  },
  "specialHandling": "Fragile"
}
```

Response (success):
```json
{
  "ok": true,
  "shipment": {
    "id": "shipment_cuid",
    "trackingCode": "JUMIA123456",
    "labelUrl": "https://jumia.co.ke/label/...",
    "receiptUrl": "https://jumia.co.ke/receipt/..."
  }
}
```

---

### GET /api/orders/[id]/shipping
**Retrieve shipment info**

Response:
```json
{
  "shipment": {
    "id": "shipment_cuid",
    "orderId": "order_cuid",
    "provider": "JUMIA",
    "externalId": "jumia_shipment_id",
    "trackingCode": "JUMIA123456",
    "labelUrl": "...",
    "receiptUrl": "...",
    "status": "PENDING",
    "lastSyncedAt": "2025-05-23T10:30:00Z",
    "createdAt": "2025-05-23T10:00:00Z"
  }
}
```

---

### GET /api/orders/[id]/tracking
**Get live tracking updates (called by TrackingWidget)**

Response:
```json
{
  "ok": true,
  "tracking": {
    "status": "in_transit",
    "lastUpdate": "2025-05-23T12:00:00Z",
    "currentLocation": "Nairobi Distribution Center",
    "estimatedDelivery": "2025-05-24T18:00:00Z",
    "message": "Package in final delivery route",
    "labelUrl": "...",
    "cached": false
  }
}
```

---

## Webhook Signatures

### Korapay Webhook
- **Endpoint:** `POST /api/korapay/webhook`
- **No signature verification** in current implementation (add later)
- **Body:** `{ status, reference, transaction_id, ... }`

### Jumia Webhook
- **Endpoint:** `POST /api/jumia/webhook`
- **Header:** `X-Jumia-Signature` (HMAC-SHA256)
- **Body:** `{ shipment_id, status, current_location, estimated_delivery, message, ... }`

---

## Monitoring & Debugging

### Check Order State
```bash
npm run db:studio
# Query: select * from "Order" where id = 'your_order_id'
# Check: status, paymentGateway, trackingCode, paymentTxnRef
```

### Check Shipment State
```bash
# In db:studio:
# Query: select * from "Shipment" where "orderId" = 'your_order_id'
# Check: status, externalId, trackingCode, lastSyncedAt
```

### Enable Debug Logs
```bash
# In .env.local:
DEBUG=*
# Then check terminal for [Payment], [Shipping], [Tracking] logs
```

---

## Next Steps After Testing

1. **Get real Korapay credentials:**
   - Set `KORAPAY_LIVE=1` in production
   - Set real `KORAPAY_PUBLIC_KEY` and `KORAPAY_SECRET_KEY`
   - Configure webhook in Korapay dashboard pointing to `/api/korapay/webhook`

2. **Get real Jumia credentials:**
   - Set real `JUMIA_LOGISTICS_API_KEY`
   - Configure webhook in Jumia dashboard pointing to `/api/jumia/webhook`
   - Use production Jumia base URL

3. **Add signature verification:**
   - Uncomment webhook signature checks (currently optional)
   - Store webhook secrets in secure env vars

4. **Handle edge cases:**
   - Retry logic for failed shipment creation
   - Partial shipments (split orders)
   - Shipment cancellation/return flow
   - Multi-provider support (add more logistics providers later)

---

## Troubleshooting Checklist

| Issue | Check |
|-------|-------|
| Checkout fails | KORAPAY_LIVE env var set? Fallback to Monnify working? |
| Can't create shipment | Order status is PAID/SHIPPED? Shipping address exists? |
| Tracking widget empty | Shipment created? Status updates received? |
| Webhook fails | Signature correct? Endpoint registered? Right headers? |
| Button/component missing | Component imported on the page? CSS classes loaded? |

