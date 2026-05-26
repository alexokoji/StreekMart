import { expect, test, vi } from 'vitest'

vi.mock('@/lib/db', () => {
  return {
    prisma: {
      user: { findUnique: vi.fn() },
    },
  }
})

vi.mock('@/lib/auth', () => ({
  requireApiUser: vi.fn().mockResolvedValue({ session: { sub: 'user1' } }),
}))

import { POST } from '@/app/api/logistics/rates/route'
import { prisma } from '@/lib/db'

test('rates route returns couriers array using stubbed Shipbubble', async () => {
  ;(prisma.user.findUnique as any).mockResolvedValue({ id: 'user1', country: 'NG', city: 'Abuja', region: 'FCT' })

  const req = {
    json: async () => ({
      provider: 'SHIPBUBBLE',
      pickupCity: 'Lagos',
      pickupState: 'Lagos',
      pickupCountry: 'NG',
      deliveryCity: 'Abuja',
      deliveryState: 'FCT',
      deliveryCountry: 'NG',
    }),
  } as unknown as Request

  const res = await POST(req)
  expect(res).toBeDefined()
  const data = await res.json()
  expect(data.ok).toBe(true)
  expect(data.rates).toBeDefined()
})
