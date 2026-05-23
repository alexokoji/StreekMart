# Sendbox Integration - Quick Start Guide

## ⚡ 5-Minute Setup

### 1. Apply Database Migration
```bash
npm run db:generate
npm run db:migrate
```

### 2. Configure Environment
Create/update `.env.local`:
```bash
SENDBOX_LIVE=0
SENDBOX_API_KEY=test_key
SENDBOX_BASE_URL=https://sandbox.staging.sendbox.co
SENDBOX_WEBHOOK_SECRET=test_secret
```

### 3. Test Stub Mode
```bash
curl -X POST http://localhost:3000/api/logistics/rates \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "SENDBOX",
    "pickupCity": "Lagos",
    "deliveryCity": "Abuja",
    "pickupCountry": "NG",
    "deliveryCountry": "NG"
  }'
```

Expected response:
```json
{
  "ok": true,
  "provider": "SENDBOX",
  "rates": [
    {"id": "sendbox_economy", "name": "Economy Delivery", "price": 1500, "estimatedDays": 5},
    {"id": "sendbox_standard", "name": "Standard Delivery", "price": 2500, "estimatedDays": 3},
    {"id": "sendbox_express", "name": "Express Delivery", "price": 5000, "estimatedDays": 1}
  ]
}
```

---

## 📂 Key Files

| File | Purpose |
|------|---------|
| `src/lib/providers/sendbox.ts` | Sendbox API integration |
| `src/lib/services/logistics.ts` | Provider coordinator |
| `src/app/api/logistics/routes` | Shipping API endpoints |
| `src/app/api/webhooks/sendbox/route.ts` | Webhook handler |
| `src/components/seller/ShipmentGenerationCard.tsx` | Seller UI |
| `src/components/buyer/ShipmentTracker.tsx` | Buyer UI |
| `src/lib/integrationHelpers.ts` | Utility functions |

---

## 🔧 Integrating into Pages

### Seller Dashboard
```tsx
import { ShipmentGenerationCard } from "@/components/seller/ShipmentGenerationCard";

export default function SellerOrders() {
  return (
    <div>
      {orders.map(order => (
        <ShipmentGenerationCard 
          key={order.id} 
          order={order}
          onShipmentCreated={() => refetch()}
        />
      ))}
    </div>
  );
}
```

### Buyer Order Detail
```tsx
import { ShipmentTracker } from "@/components/buyer/ShipmentTracker";

export default function OrderDetail() {
  return (
    <div>
      {order.shipment && (
        <ShipmentTracker 
          orderId={order.id}
          trackingCode={order.shipment.trackingCode}
        />
      )}
    </div>
  );
}
```

---

## 🧪 Testing Checklist

### Dev Mode (Stub)
- [ ] Fetch rates → get 3 options
- [ ] Create shipment → get tracking code
- [ ] Track shipment → see status timeline
- [ ] ShipmentGenerationCard renders
- [ ] ShipmentTracker displays timeline

### Live Mode (After Credentials)
- [ ] Set `SENDBOX_LIVE=1`
- [ ] Add real API key
- [ ] Create test shipment
- [ ] Verify label URL works
- [ ] Webhook updates status

---

## 📊 Admin Dashboard Example

```tsx
const stats = await getShippingStats({ days: 30 });
console.log(stats);
// {
//   total: 42,
//   delivered: 38,
//   inTransit: 3,
//   failed: 1,
//   successRate: 90.48
// }

const failed = await getFailedDeliveries({ limit: 5 });
failed.forEach(shipment => {
  console.log(`Order ${shipment.order.id}: Failed - ${shipment.order.buyer.email}`);
});
```

---

## 🚨 Common Issues

| Issue | Solution |
|-------|----------|
| "Provider not configured" | Check `SENDBOX_LIVE` env var, restart dev server |
| Rates return empty | In stub mode should always work - check network tab |
| Shipment creation fails | Verify order exists and seller owns it |
| Webhooks not firing | Check webhook URL is public (not localhost) |
| No tracking updates | Webhooks verify signature - check secret matches |

---

## 🔐 Going Live

1. **Get Sendbox credentials**
   - Sign up at sendbox.co
   - Generate API key
   - Get webhook secret

2. **Configure production environment**
   ```bash
   SENDBOX_LIVE=1
   SENDBOX_API_KEY=sk_live_xxxxx
   SENDBOX_WEBHOOK_SECRET=whsec_live_xxxxx
   SENDBOX_BASE_URL=https://api.sendbox.co
   ```

3. **Register webhook**
   - Go to Sendbox dashboard
   - Add webhook: `https://yourdomain.com/api/webhooks/sendbox`
   - Copy and paste secret to env

4. **Test with real shipment**
   - Create a test order
   - Generate shipment
   - Verify label downloads
   - Track updates

---

## 📚 Documentation

- **SENDBOX_INTEGRATION.md** - Complete API reference
- **SENDBOX_IMPLEMENTATION_CHECKLIST.md** - Full deployment guide
- **EXAMPLE_INTEGRATION_PAGES.tsx** - Reference implementations
- **SENDBOX_IMPLEMENTATION_SUMMARY.md** - Architecture overview

---

## 🎯 Next Steps

1. Apply database migration
2. Set environment variables
3. Test stub mode (curl or Postman)
4. Integrate components into seller/buyer pages
5. Create admin dashboard view
6. Deploy and test end-to-end
7. Go live with real Sendbox credentials

---

## 💡 Pro Tips

- **Stub mode** works without any credentials - great for development
- **Database migration** must run before any shipment operations
- **Webhook verification** prevents fake status updates - keep secret safe
- **Email notifications** are fire-and-forget (won't fail order if email fails)
- **Tracking updates every 5 minutes** by default - adjust in component if needed

---

## ✅ You're Ready!

The entire infrastructure is implemented. Next is UI integration into your existing pages.

Start with: **1. Database migration → 2. Test stub mode → 3. Integrate components → 4. Go live**
