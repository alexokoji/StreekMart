import { getLogisticsService } from '../src/lib/services/logistics'

async function main() {
  const svc = getLogisticsService()
  try {
    const rates = await svc.getShippingRates({
      provider: 'SENDBOX' as any,
      pickupAddress: 'Seller address',
      pickupCity: 'Lagos',
      pickupCountry: 'NG',
      deliveryAddress: 'Buyer address',
      deliveryCity: 'Abuja',
      deliveryCountry: 'NG',
      weight: 1,
    })
    console.log('Rates result:', JSON.stringify(rates, null, 2))
  } catch (err:any) {
    console.error('Error calling logistics.getShippingRates:', err.message || err)
    process.exit(1)
  }
}

main()
