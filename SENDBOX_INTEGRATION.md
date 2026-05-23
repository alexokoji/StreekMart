# Sendbox Logistics Integration Guide

## Overview

UpClo now supports Sendbox logistics for shipping management. This integration allows:

- **Sellers**: Generate shipments and print labels directly from their dashboard
- **Buyers**: Track shipments in real-time with live status updates
- **Admin**: Monitor logistics operations and delivery metrics

## Architecture

### Provider-Based Design

The system uses a provider-based architecture to support multiple logistics providers:

```
LogisticsService (Coordinator)
├── SendboxProvider (implements LogisticsProvider)
├── JumiaProvider (future)
├── DellymanProvider (future)
└── ...
```

### Database Models

**Shipment**: Stores shipment details
- `provider`: Logistics provider (SENDBOX, JUMIA, etc.)
- `externalId`: Provider's shipment ID
- `trackingCode`: Buyer-visible tracking code
- `status`: Current shipment status
- `labelUrl`: Download link for shipping label

**ShippingRate**: Stores rate quotes
- Captures rates shown to buyers during checkout
- Tracks which rate was selected
- Allows analytics on delivery options

## Configuration

### Environment Variables

```bash
# Enable live mode (1 = live, 0 = stub/sandbox)
SENDBOX_LIVE=0

# Sendbox API credentials
SENDBOX_API_KEY=your_api_key
SENDBOX_BASE_URL=https://sandbox.staging.sendbox.co

# Webhook signature verification
SENDBOX_WEBHOOK_SECRET=your_webhook_secret
```

### Staging vs Production

**Staging (Development)**:
```
SENDBOX_BASE_URL=https://sandbox.staging.sendbox.co
SENDBOX_LIVE=0
```

**Production**:
```
SENDBOX_BASE_URL=https://api.sendbox.co
SENDBOX_LIVE=1
```

## API Routes

### Get Shipping Rates

```
POST /api/logistics/rates
Content-Type: application/json

{
  "provider": "SENDBOX",
  "pickupCity": "Lagos",
  "pickupCountry": "NG",
  "deliveryCity": "Abuja",
  "deliveryCountry": "NG",
  "weight": 1.5,
  "description": "Fashion items"
}

Response:
{
  "ok": true,
  "provider": "SENDBOX",
  "rates": [
    {
      "id": "sendbox_economy",
      "name": "Economy Delivery",
      "code": "ECONOMY",
      "estimatedDays": 5,
      "price": 1500  // in cents
    },
    {
      "id": "sendbox_standard",
      "name": "Standard Delivery",
      "code": "STANDARD",
      "estimatedDays": 3,
      "price": 2500
    },
    {
      "id": "sendbox_express",
      "name": "Express Delivery",
      "code": "EXPRESS",
      "estimatedDays": 1,
      "price": 5000
    }
  ]
}
```

### Create Shipment

```
POST /api/logistics/create
Content-Type: application/json
Authorization: Bearer <session_token>

{
  "orderId": "order_id_here",
  "provider": "SENDBOX",
  "courierCode": "STANDARD"  // optional
}

Response:
{
  "ok": true,
  "shipment": {
    "id": "shipment_id",
    "externalId": "SBX-123456",
    "trackingCode": "SENDBOX-ABC123",
    "labelUrl": "https://...",
    "estimatedDelivery": "2024-05-26T00:00:00Z"
  }
}
```

### Track Shipment

```
GET /api/logistics/track?orderId=order_id_here
Authorization: Bearer <session_token>

Response:
{
  "ok": true,
  "tracking": {
    "status": "in_transit",
    "lastUpdate": "2024-05-24T10:30:00Z",
    "currentLocation": "Distribution Center, Abuja",
    "estimatedDelivery": "2024-05-26T00:00:00Z",
    "message": "Your package is in transit to Abuja"
  }
}
```

## Workflows

### Seller Shipment Creation Flow

1. Seller navigates to Orders dashboard
2. Clicks "Generate Shipment" on an order
3. System pre-fills:
   - Seller details (from User profile)
   - Buyer details (from Order)
   - Product info (from Order.product)
4. Seller selects shipping method:
   - Economy (5 days, $15)
   - Standard (3 days, $25)
   - Express (1 day, $50)
5. Seller clicks "Confirm Shipment"
6. System calls Sendbox API to create shipment
7. Shipment saved to database with tracking code
8. Order status updated to SHIPPED
9. Label URL provided for printing

### Buyer Tracking Flow

1. Buyer navigates to their orders
2. Clicks "Track" on an order with a shipment
3. System fetches current tracking from Sendbox
4. Displays:
   - Current status (Pending → Picked → In Transit → Out for Delivery → Delivered)
   - Last update timestamp
   - Current location
   - Estimated delivery date
   - Shipment tracking code
5. Real-time updates via webhooks automatically sync status

### Webhook Flow

1. Sendbox detects status change (picked, in transit, delivered, etc.)
2. Sends webhook to `/api/webhooks/sendbox`
3. System verifies webhook signature
4. Updates Shipment status in database
5. Sends notification email to buyer
6. Buyer sees updated status on Order tracking page

## Shipment Status Flow

```
PENDING
  ↓ (picked up)
PICKED
  ↓ (in transit)
IN_TRANSIT
  ↓ (out for delivery)
OUT_FOR_DELIVERY
  ↓ (successfully delivered)
DELIVERED

OR at any point:
FAILED (delivery issue)
CANCELLED (shipment cancelled)
```

## Implementation Examples

### For Sellers

```typescript
// In seller dashboard, call this to create a shipment
const response = await fetch("/api/logistics/create", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    orderId: order.id,
    provider: "SENDBOX",
  }),
});

const { shipment } = await response.json();
console.log("Tracking:", shipment.trackingCode);
console.log("Download label:", shipment.labelUrl);
```

### For Buyers

```typescript
// In order tracking page, call this for live status
const response = await fetch(
  `/api/logistics/track?orderId=${orderId}`
);

const { tracking } = await response.json();
console.log("Status:", tracking.status);
console.log("Location:", tracking.currentLocation);
```

## Admin Dashboard Features

### Shipments View

- List all active shipments
- Filter by status (Pending, Picked, In Transit, etc.)
- Filter by provider (Sendbox, Jumia, etc.)
- Search by tracking code
- Bulk actions (print labels, cancel shipments)

### Delivery Analytics

- Shipments by provider
- Delivery success rate
- Average delivery time
- Failed deliveries (with reasons)
- Delivery costs analysis

### Failed Deliveries

- List shipments with failed status
- Show failure reason
- Contact information for buyers
- Retry or reship options

## Testing

### Stub Mode (Development)

When `SENDBOX_LIVE=0`, the provider returns synthetic data:

```typescript
// Get rates will return 3 options:
// - Economy: 5 days, $15
// - Standard: 3 days, $25
// - Express: 1 day, $50

// Create shipment will return:
// - Random tracking code (SENDBOX-XXXXXXXX)
// - Sample label/receipt URLs
// - 3-day estimated delivery

// Track will return:
// - Random status from available options
// - Current location: "Distribution Center, Lagos"
```

### Live Mode (Production)

When `SENDBOX_LIVE=1`:
- All API calls go to real Sendbox servers
- Actual shipments are created
- Real tracking codes and labels
- Live webhook updates

## Security

### Authentication

- All logistics API routes require authentication
- Only sellers can create shipments for their orders
- Buyers/sellers can only track their own shipments

### Webhook Verification

- All incoming Sendbox webhooks are signature-verified
- Invalid signatures are rejected
- Webhook secret stored in env variables

### Data Protection

- Sensitive fields (API keys, secrets) never logged
- PII (buyer phone, address) handled carefully
- SSL/TLS for all external API calls

## Future Providers

The architecture supports adding new providers. To add a new provider:

1. Create `src/lib/providers/yourprovider.ts` implementing `LogisticsProvider`
2. Update `LogisticsService` to initialize it
3. Add env variables for configuration
4. Add webhook handler at `/api/webhooks/yourprovider`

```typescript
export class YourProviderClass implements LogisticsProvider {
  getName(): string { return "YOUR_PROVIDER"; }
  async createShipment(input) { ... }
  async getTracking(input) { ... }
  verifyWebhookSignature(body, sig) { ... }
}
```

## Troubleshooting

### "Logistics provider is not configured"

- Check that the provider name is spelled correctly
- Verify the provider is initialized in LogisticsService
- Check environment variables are set

### "Failed to fetch shipping rates"

- In stub mode, rates should always return successfully
- In live mode, check API key and network connectivity
- Check pickup/delivery location format

### "Shipment already exists"

- Each order can have only one active shipment
- Cancel the existing shipment before creating a new one

### Webhooks not updating

- Check webhook URL is publicly accessible
- Verify webhook secret in environment
- Check Sendbox webhook delivery logs in their dashboard

## Monitoring

### Key Metrics to Track

- Shipments created per day
- Delivery success rate
- Average delivery time by provider
- Failed delivery rate
- Average cost per shipment

### Logs to Monitor

- API call success/failure rates
- Webhook processing times
- Provider error rates
- Database transaction integrity
