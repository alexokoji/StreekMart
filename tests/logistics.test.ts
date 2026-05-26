import { expect, test } from 'vitest'
import { getLogisticsService } from '@/lib/services/logistics'

test('LogisticsService automatic fallback works', async () => {
  process.env.SHIPBUBBLE_ENABLED = '0'
  process.env.KWIK_ENABLED = '1'
  process.env.AUTO_FALLBACK_TO_KWIK = 'true'
  
  const svc = getLogisticsService()
  
  // Simulate Shipbubble throwing an error (e.g. timeout or API failure)
  const shipbubble = svc.getProvider('SHIPBUBBLE') as any;
  const originalGetRates = shipbubble.getShippingRates;
  shipbubble.getShippingRates = async () => {
    throw new Error('API Timeout');
  };
  
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
    weight: 0.2,
  });
  
  expect(Array.isArray(rates)).toBe(true);
  expect(rates.length).toBeGreaterThan(0);
  expect(rates[0].provider).toBe('KWIK'); // Verify it fell back to Kwik
  
  // Restore original function
  shipbubble.getShippingRates = originalGetRates;
});
