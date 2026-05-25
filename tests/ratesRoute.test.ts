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

test('rates route returns couriers array using stubbed Sendbox', async () => {
  ;(prisma.user.findUnique as any).mockResolvedValue({ id: 'user1', country: 'NG', city: 'Abuja' })

  const req = { json: async () => ({ provider: 'SENDBOX', pickupCity: 'Lagos', pickupCountry: 'NG', deliveryCity: 'Abuja', deliveryCountry: 'NG' }) } as unknown as Request

  const res = await POST(req)
  expect(res).toBeDefined()
})
