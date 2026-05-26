import { expect, test } from 'vitest'
import { getLogisticsService } from '@/lib/services/logistics'

test('getShippingRates returns array-like rates for Shipbubble provider', async () => {
  const svc = getLogisticsService()
  const rates = await svc.getShippingRates({
    pickupAddress: {
      address: 'Seller address',
      city: 'Lagos',
      state: 'Lagos',
      country: 'NG',
    },
    deliveryAddress: {
      address: 'Buyer address',
      city: 'Abuja',
      state: 'FCT',
      country: 'NG',
    },
    weight: 1,
  })
  expect(Array.isArray(rates)).toBe(true)
  expect(rates.length).toBeGreaterThan(0)
  expect(rates[0].provider).toBe('SHIPBUBBLE')
})
