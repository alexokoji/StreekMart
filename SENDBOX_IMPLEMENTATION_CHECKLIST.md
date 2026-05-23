# Sendbox Integration Implementation Checklist

## ✅ Completed Infrastructure

### Database & Schema
- [x] Enhanced `Shipment` model with Sendbox fields
  - Added `courierName`, `senderName/Phone/Address`, `recipientDetails`
  - Added `shippingFeeCents`, `sellerReference`, `estimatedDeliveryAt`
  - Added provider support for multiple couriers
- [x] Created `ShippingRate` model for capturing quotes
  - Stores rates shown to buyers during checkout
  - Tracks which rate was selected
- [x] Updated `Order` model
  - Added `logisticsProvider` field
  - Added `shippingRates` relation

### Provider Infrastructure
- [x] Implemented `SendboxProvider` class
  - `getShippingRates()` - Get courier options
  - `createShipment()` - Create shipment
  - `getTracking()` - Fetch tracking status
  - `verifyWebhookSignature()` - Verify incoming webhooks
  - Stub mode for development (returns synthetic data)
  - Live mode ready for production API calls

- [x] Created `LogisticsService` coordinator
  - Manages provider initialization
  - Supports multiple providers (extensible)
  - Central entry point for all logistics operations

### API Routes
- [x] `POST /api/logistics/rates` - Get shipping rate quotes
- [x] `POST /api/logistics/create` - Create shipments (sellers only)
- [x] `GET /api/logistics/track` - Track shipments (buyers/sellers)
- [x] `POST /api/webhooks/sendbox` - Receive status updates
  - Signature verification
  - Automatic status updates
  - Email notifications to buyers

### Environment Configuration
- [x] Added environment variables to `.env.example`
  - `SENDBOX_LIVE` - Enable/disable stub mode
  - `SENDBOX_API_KEY` - API credentials
  - `SENDBOX_BASE_URL` - Staging/production endpoint
  - `SENDBOX_WEBHOOK_SECRET` - Webhook verification

### UI Components
- [x] `ShipmentGenerationCard` (seller)
  - Display order details
  - Select shipping method
  - Show tracking code after creation
  - Download label link

- [x] `ShipmentTracker` (buyer)
  - Timeline visualization
  - Live status updates
  - Estimated delivery display
  - Auto-refresh capability

### Helper Functions
- [x] `src/lib/integrationHelpers.ts`
  - `saveShippingRateQuotes()` - Snapshot rates
  - `getOrderShippingRates()` - Retrieve quote history
  - `getShipmentDetails()` - Get full shipment info
  - `getSellerActiveShipments()` - Seller dashboard
  - `getShippingStats()` - Admin analytics
  - `getFailedDeliveries()` - Admin issue tracking
  - `getAverageDeliveryTime()` - Performance metrics
  - `getProblematicShipments()` - Alert monitoring

### Documentation
- [x] `SENDBOX_INTEGRATION.md` - Complete integration guide
  - Architecture overview
  - API endpoint documentation
  - Workflow diagrams
  - Testing instructions
  - Future provider roadmap

---

## ⏳ Next Steps (Wire-up in UI)

### Phase 1: Database Migration
```bash
# Generate and apply schema changes
npm run db:generate
npm run db:migrate

# Or if using Turso/production
npx prisma migrate deploy
```

### Phase 2: Seller Dashboard Integration

#### Orders Page
1. Import `ShipmentGenerationCard`:
   ```tsx
   import { ShipmentGenerationCard } from "@/components/seller/ShipmentGenerationCard";
   ```

2. Add to order list:
   ```tsx
   {orders.map((order) => (
     <ShipmentGenerationCard 
       key={order.id}
       order={order}
       onShipmentCreated={() => refetchOrders()}
     />
   ))}
   ```

#### Seller Order Detail Page
1. Show shipment status and tracking:
   ```tsx
   {order.shipment && (
     <div>
       <h3>Shipment</h3>
       <p>Tracking: {order.shipment.trackingCode}</p>
       <p>Status: {order.shipment.status}</p>
       {order.shipment.labelUrl && (
         <a href={order.shipment.labelUrl} download>
           Download Label
         </a>
       )}
     </div>
   )}
   ```

2. Link to create shipment if not exists:
   ```tsx
   {!order.shipment && (
     <ShipmentGenerationCard order={order} />
   )}
   ```

### Phase 3: Buyer Tracking Integration

#### Order Detail Page
1. Import and use tracker:
   ```tsx
   import { ShipmentTracker } from "@/components/buyer/ShipmentTracker";
   ```

2. Show tracker if shipment exists:
   ```tsx
   {order.shipment && (
     <div>
       <h2>Track Your Order</h2>
       <ShipmentTracker 
         orderId={order.id}
         trackingCode={order.shipment.trackingCode}
       />
     </div>
   )}
   ```

#### Order List Page
1. Show shipment status badge:
   ```tsx
   {order.shipment && (
     <span className="text-sm font-medium">
       {order.shipment.status}
     </span>
   )}
   ```

### Phase 4: Checkout Integration (Optional)

To show shipping options during checkout:

1. Fetch rates:
   ```tsx
   const response = await fetch("/api/logistics/rates", {
     method: "POST",
     body: JSON.stringify({
       provider: "SENDBOX",
       pickupCity: seller.city,
       deliveryCity: buyer.city,
       pickupCountry: seller.country,
       deliveryCountry: buyer.country,
       weight: 1.5,
     }),
   });
   const { rates } = await response.json();
   ```

2. Display rates to buyer:
   ```tsx
   {rates.map((rate) => (
     <button onClick={() => selectRate(rate)}>
       {rate.name} - ${rate.price/100} ({rate.estimatedDays} days)
     </button>
   ))}
   ```

3. Save selected rate:
   ```tsx
   await saveShippingRateQuotes({
     orderId: createdOrder.id,
     provider: "SENDBOX",
     rates,
     selectedRateId: selectedRate.id,
   });
   ```

### Phase 5: Admin Dashboard

Create an admin page at `/admin/logistics` with:

1. Shipments overview:
   ```tsx
   const stats = await getShippingStats();
   // Display: total, in-transit, delivered, failed, success rate
   ```

2. Failed deliveries list:
   ```tsx
   const failed = await getFailedDeliveries();
   // Show with buyer contact for manual follow-up
   ```

3. Performance metrics:
   ```tsx
   const avgDeliveryDays = await getAverageDeliveryTime();
   const problematic = await getProblematicShipments();
   ```

---

## 🧪 Testing Checklist

### Development Mode (Stub)
- [x] Environment configured with `SENDBOX_LIVE=0`
- [ ] Fetch rates returns 3 courier options
- [ ] Create shipment returns valid tracking code
- [ ] Tracking returns synthetic status updates
- [ ] Seller can see shipment card with all options
- [ ] Buyer can track order with timeline

### Live Mode (Production)
- [ ] Sendbox API key obtained and configured
- [ ] `SENDBOX_BASE_URL` set correctly
- [ ] Webhook URL registered in Sendbox dashboard
- [ ] Test shipment creation with real data
- [ ] Verify label PDF downloads
- [ ] Test webhook signature verification
- [ ] Confirm buyer receives status emails

### End-to-End Flows
- [ ] Seller creates shipment → label downloads
- [ ] Tracking code shows on order
- [ ] Buyer views tracker → timeline displays
- [ ] Webhook updates status → buyer notified
- [ ] Failed delivery handled gracefully

---

## 📋 Configuration Checklist

### Environment Variables
```bash
# Development
SENDBOX_LIVE=0
SENDBOX_BASE_URL=https://sandbox.staging.sendbox.co
SENDBOX_API_KEY=test_key_here
SENDBOX_WEBHOOK_SECRET=test_secret_here

# Production (after obtaining real credentials)
SENDBOX_LIVE=1
SENDBOX_BASE_URL=https://api.sendbox.co
SENDBOX_API_KEY=sk_live_xxxxx
SENDBOX_WEBHOOK_SECRET=whsec_live_xxxxx
```

### Database
```bash
# Apply schema changes
npm run db:migrate

# Verify models
npm run db:studio  # Check Shipment and ShippingRate tables
```

### Webhook Setup
1. Go to Sendbox dashboard
2. Navigate to Webhooks/API Settings
3. Register endpoint: `https://yourdomain.com/api/webhooks/sendbox`
4. Copy webhook secret to env
5. Test webhook delivery

---

## 🔌 API Response Examples

### Get Rates
```json
{
  "ok": true,
  "provider": "SENDBOX",
  "rates": [
    {
      "id": "sendbox_economy",
      "name": "Economy Delivery",
      "code": "ECONOMY",
      "estimatedDays": 5,
      "price": 1500
    }
  ]
}
```

### Create Shipment
```json
{
  "ok": true,
  "shipment": {
    "id": "shipment_id",
    "externalId": "SBX-123456",
    "trackingCode": "SENDBOX-ABC123",
    "labelUrl": "https://sendbox.co/labels/...",
    "estimatedDelivery": "2024-05-26T00:00:00Z"
  }
}
```

### Track Shipment
```json
{
  "ok": true,
  "tracking": {
    "status": "in_transit",
    "lastUpdate": "2024-05-24T10:30:00Z",
    "currentLocation": "Distribution Center, Abuja",
    "estimatedDelivery": "2024-05-26T00:00:00Z",
    "message": "Your package is in transit"
  }
}
```

---

## 🚀 Deployment Checklist

- [ ] Schema migrated to production database
- [ ] Environment variables set on production
- [ ] UI components integrated into pages
- [ ] Webhook endpoint publicly accessible
- [ ] Load testing done (10+ concurrent shipments)
- [ ] Error handling verified
- [ ] Email notifications tested
- [ ] Monitoring alerts configured
- [ ] Runbook created for support team
- [ ] User documentation drafted

---

## 📞 Support

For issues:
1. Check stub mode works (SENDBOX_LIVE=0)
2. Verify API credentials if in live mode
3. Check webhook logs in Sendbox dashboard
4. Review database for shipment records
5. Check application logs for errors

See `SENDBOX_INTEGRATION.md` for complete API docs.
