# Quick Integration Reference

## For Seller Order Detail Page

Add the shipment creation form:

```tsx
import { ShippingPanel } from "@/components/seller/ShippingPanel";

export default function SellerOrderDetail({ orderId, order }) {
  return (
    <div>
      <h1>Order #{orderId}</h1>
      
      {/* Your existing order details here */}
      
      {/* Add this shipment creation panel */}
      <ShippingPanel 
        orderId={orderId} 
        orderStatus={order.status}
        onSuccess={() => {
          // Optionally refresh order or show success toast
          console.log("Shipment created!");
        }}
      />
    </div>
  );
}
```

**Component Props:**
- `orderId: string` — Order ID
- `orderStatus: string` — Current order status (PAID, SHIPPED, etc.)
- `onSuccess?: () => void` — Called after successful shipment creation

---

## For Buyer Order Detail Page

Add the tracking widget:

```tsx
import { TrackingWidget } from "@/components/buyer/TrackingWidget";

export default function BuyerOrderDetail({ orderId, order }) {
  return (
    <div>
      <h1>Order #{orderId}</h1>
      
      {/* Your existing order details here */}
      
      {/* Add this tracking widget */}
      <TrackingWidget orderId={orderId} />
    </div>
  );
}
```

**Component Props:**
- `orderId: string` — Order ID

**Auto-features:**
- Polls tracking endpoint every 30 seconds
- Shows status, location, ETA
- Download shipping label link
- Handles missing shipments gracefully

---

## API Endpoints Cheat Sheet

### Create Shipment (Seller)
```bash
POST /api/orders/[orderId]/shipping
Content-Type: application/json

{
  "weight": 1.5,
  "dimensions": {
    "length": 20,
    "width": 15,
    "height": 10
  },
  "specialHandling": "Fragile"
}

# Response:
{
  "ok": true,
  "shipment": {
    "id": "...",
    "trackingCode": "JUMIA123456",
    "labelUrl": "https://...",
    "receiptUrl": "https://..."
  }
}
```

### Get Shipment Details
```bash
GET /api/orders/[orderId]/shipping

# Response:
{
  "shipment": {
    "id": "...",
    "trackingCode": "...",
    "status": "PENDING|PICKED|IN_TRANSIT|DELIVERED|FAILED",
    "labelUrl": "...",
    "receiptUrl": "...",
    "createdAt": "2025-05-23T...",
    "lastSyncedAt": "2025-05-23T..."
  }
}
```

### Get Live Tracking
```bash
GET /api/orders/[orderId]/tracking

# Response:
{
  "ok": true,
  "tracking": {
    "status": "in_transit",
    "lastUpdate": "2025-05-23T...",
    "currentLocation": "Nairobi Hub",
    "estimatedDelivery": "2025-05-24T18:00:00Z",
    "message": "In final delivery route",
    "labelUrl": "https://...",
    "cached": false
  }
}
```

---

## Styling Guide

### ShippingPanel
- Uses Tailwind classes
- Can override with custom CSS
- Button styling: `bg-blue-600 hover:bg-blue-700`
- Error/success messages color-coded

### TrackingWidget
- Status badge colors:
  - `pending` → gray
  - `picked` → blue
  - `in_transit` → orange
  - `delivered` → green
  - `failed` → red
- Responsive grid layout
- Updates indicator at bottom

---

## Error Handling

### ShippingPanel Errors
```tsx
<ShippingPanel onSuccess={handleSuccess} />
// Shows inline error messages
// Displays red error box with error message
// User can retry after fixing form
```

### TrackingWidget Fallback
```tsx
<TrackingWidget orderId={orderId} />
// If shipment not created: "Shipment tracking will appear once..."
// If API down: Shows cached data with "Showing cached data" note
// If no data: Shows loading skeleton while polling
```

---

## Common Scenarios

### Scenario: Order just paid, no shipment yet
- ShippingPanel shows "Shipment can only be created after payment confirmed"
- TrackingWidget shows "Shipment tracking will appear once your order is dispatched"

### Scenario: Shipment created, awaiting pickup
- ShippingPanel shows success with tracking code + label download
- TrackingWidget shows status: "Pending" with tracking code and label link

### Scenario: Shipment in transit
- TrackingWidget shows status: "In Transit"
- Current location: "Nairobi Distribution Center"
- Estimated delivery updated real-time

### Scenario: Shipment delivered
- Order status automatically changed to COMPLETED
- TrackingWidget shows status: "Delivered" with completion timestamp
- Buyer can leave review

---

## Database Queries

### Find orders with shipments
```sql
SELECT o.* FROM "Order" o
JOIN "Shipment" s ON o.id = s."orderId"
WHERE o."sellerId" = 'seller_id'
ORDER BY o."createdAt" DESC;
```

### Check shipment status
```sql
SELECT "trackingCode", "status", "lastSyncedAt" 
FROM "Shipment"
WHERE "orderId" = 'order_id';
```

### Find SHIPPED orders without delivery
```sql
SELECT id, "trackingCode", status 
FROM "Order"
WHERE status = 'SHIPPED' 
AND "createdAt" < now() - interval '7 days'
ORDER BY "createdAt" ASC;
```

---

## Debugging Tips

### Enable detailed logging
```bash
# In .env.local
DEBUG=*
```

### Check payment gateway used
```bash
# In browser console after checkout
fetch('/api/orders/[id]').then(r => r.json()).then(o => console.log(o.paymentGateway))
```

### Verify shipment created
```bash
# In db:studio or psql
SELECT * FROM "Shipment" WHERE "orderId" = 'order_id';
```

### Simulate Jumia webhook
```bash
curl -X POST http://localhost:3000/api/jumia/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "shipment_id": "ext_id_from_shipment_record",
    "status": "delivered",
    "message": "Successfully delivered"
  }'
```

---

## Performance Notes

- Tracking widget polls every 30s (configurable in TrackingWidget.tsx)
- Shipment creation is ~1-2s per API call to Jumia
- Tracking fetch is ~500ms typical latency
- Cache fallback used if Jumia down (instant response)

---

## Security Reminders

- Never log API keys or secrets
- Webhook endpoints validate payloads (add signature verification)
- All order/shipment access checks user permissions
- Tracking code shared with buyer; not sensitive (tracking is public)

---

Need help? See **INTEGRATION_GUIDE.md** for detailed setup and testing.
