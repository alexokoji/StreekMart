import { expect, test } from 'vitest'
import { CheckoutBodySchema } from '@/app/api/cart/checkout/route'

test('checkout body schema accepts shippingChoices shape', () => {
  const payload = {
    shippingAddress: '123 Main St, Lagos',
    paymentMethod: 'DIRECT',
    shippingChoices: [
      { sellerId: 'seller1', provider: 'SENDBOX', courierId: 'c1', courierName: 'EasyShip', priceCents: 5000, estimatedDays: 3 },
    ],
  }
  const parsed = CheckoutBodySchema.safeParse(payload)
  expect(parsed.success).toBe(true)
})
