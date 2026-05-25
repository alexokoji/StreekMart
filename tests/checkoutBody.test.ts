import { expect, test } from 'vitest'
import { Body } from '@/app/api/cart/checkout/route'

test('checkout body schema accepts shippingChoices shape', () => {
  const payload = {
    cartId: 'cart123',
    paymentMethod: 'CARD',
    shippingChoices: [
      { sellerId: 'seller1', provider: 'SENDBOX', courierId: 'c1', courierName: 'EasyShip', priceCents: 5000, estimatedDays: 3 },
    ],
  }
  const parsed = Body.safeParse(payload)
  expect(parsed.success).toBe(true)
})
