import { expect, test } from 'vitest'

// Basic smoke test for rates endpoint shape. We don't start the server here;
// instead we assert our local provider helper returns an array-like shape.
import { getLogisticsService } from '@/lib/services/logistics'

test('getShippingRates returns array-like rates for Sendbox provider', async () => {
  const svc = getLogisticsService()
  const rates = await svc.getShippingRates({
    provider: 'SENDBOX',
    pickupAddress: 'Seller address',
    pickupCity: 'Lagos',
    pickupCountry: 'NG',
    deliveryAddress: 'Buyer address',
    deliveryCity: 'Abuja',
    deliveryCountry: 'NG',
    weight: 1,
  } as any)
  expect(Array.isArray(rates)).toBe(true)
})
