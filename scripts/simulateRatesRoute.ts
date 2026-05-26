import { getLogisticsService } from '../src/lib/services/logistics'

async function main() {
  const svc = getLogisticsService()
  try {
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
        state: 'Abuja',
        country: 'NG',
      },
      weight: 1,
    })
    console.log('Rates result:', JSON.stringify(rates, null, 2))
  } catch (err:any) {
    console.error('Error calling logistics.getShippingRates:', err.message || err)
    process.exit(1)
  }
}

main()
