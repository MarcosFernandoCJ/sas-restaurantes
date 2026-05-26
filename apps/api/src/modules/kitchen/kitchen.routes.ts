import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'

export async function kitchenRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /kitchen/queue — Unauthenticated endpoint for kitchen display initial data load.
  // Returns all paid orders not yet delivered/cancelled, ordered FIFO with additionals last.
  fastify.get('/kitchen/queue', async (_request, reply) => {
    const orders = await prisma.order.findMany({
      where: {
        status: { notIn: ['delivered', 'cancelled'] },
        invoice: { status: 'paid' },
      },
      include: {
        items: {
          include: {
            menuItem: { select: { name: true } },
          },
          orderBy: { status: 'asc' },
        },
        table: { select: { number: true } },
      },
      orderBy: [
        { isAdditional: 'asc' },
        { createdAt: 'asc' },
      ],
    })

    type KitchenOrderRow = {
      id: string; orderNumber: number; type: string; isAdditional: boolean
      parentOrderId: string | null; notes: string | null; createdAt: Date
      table: { number: number } | null
      items: Array<{ id: string; quantity: number; notes: string | null; status: string; menuItem: { name: string } }>
    }

    const payload = (orders as KitchenOrderRow[]).map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      type: o.type,
      tableNumber: o.table?.number ?? undefined,
      isAdditional: o.isAdditional,
      parentOrderId: o.parentOrderId ?? undefined,
      notes: o.notes ?? undefined,
      createdAt: o.createdAt.toISOString(),
      items: o.items.map((item) => ({
        id: item.id,
        menuItemName: item.menuItem.name,
        quantity: item.quantity,
        notes: item.notes ?? undefined,
        status: item.status,
      })),
    }))

    return reply.status(200).send(payload)
  })
}