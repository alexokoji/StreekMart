import { expect, test, vi } from 'vitest'

// Mock prisma and auth so this test doesn't need a real database or auth.
vi.mock('@/lib/db', () => {
  const orderFindUnique = vi.fn()
  const shipmentFindFirst = vi.fn()
  const shipmentCreate = vi.fn()
  const orderUpdate = vi.fn()
  const orderUpdateCreate = vi.fn()

  return {
    prisma: {
      order: { findUnique: orderFindUnique, update: orderUpdate },
      shipment: { findFirst: shipmentFindFirst, create: shipmentCreate },
      orderUpdate: { create: orderUpdateCreate },
    },
  }
})

vi.mock('@/lib/auth', () => ({
  requireApiUser: vi.fn().mockResolvedValue({ session: { sub: 'seller1' } }),
}))

import { POST } from '@/app/api/orders/[id]/shipping/route'
import { prisma } from '@/lib/db'

test('creating a shipment for a within-city order uses provider LOCAL_SELLER', async () => {
  // Arrange: make prisma return an order that is within-city and PAID
  ;(prisma.order.findUnique as any).mockResolvedValue({
    id: 'order123',
    sellerId: 'seller1',
    status: 'PAID',
    deliveryZone: 'WITHIN_CITY',
    shippingAddress: '123 Local St',
    buyer: { name: 'Buyer', phone: '555-0100' },
    product: { name: 'Widget' },
  })

  ;(prisma.shipment.findFirst as any).mockResolvedValue(null)
  ;(prisma.shipment.create as any).mockResolvedValue({ id: 'sh_1', provider: 'LOCAL_SELLER' })
  ;(prisma.order.update as any).mockResolvedValue({})
  ;(prisma.orderUpdate.create as any).mockResolvedValue({})

  const req = { json: async () => ({}) } as unknown as Request

  // Act
  const res = await POST(req, { params: { id: 'order123' } })

  // Assert: prisma.shipment.create was called and used LOCAL_SELLER
  expect((prisma.shipment.create as any).mock.calls.length).toBeGreaterThan(0)
  const calledArg = (prisma.shipment.create as any).mock.calls[0][0]
  expect(calledArg.data.provider).toBe('LOCAL_SELLER')

  // Also ensure response indicates success
  expect(res).toBeDefined()
})
