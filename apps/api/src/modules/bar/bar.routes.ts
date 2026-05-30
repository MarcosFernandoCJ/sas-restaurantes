import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'

// Bar shows only items where assignedArea = 'bar' and requiresPreparation = true.
// Same lifecycle as kitchen: pending → in_prep → ready → served.
type BarItem = {
  id: string
  menuItemName: string
  quantity: number
  notes?: string
  status: string
}

type BarPayload = {
  id: string
  orderNumber: number
  type: string
  tableNumber?: number
  isAdditional: boolean
  parentOrderId?: string
  notes?: string
  createdAt: string
  items: BarItem[]
}

function mapOrder(o: {
  id: string
  orderNumber: number
  type: string
  isAdditional: boolean
  parentOrderId: string | null
  notes: string | null
  createdAt: Date
  table: { number: number } | null
  items: Array<{
    id: string
    quantity: number
    notes: string | null
    status: string
    assignedArea: string
    menuItem: { name: string }
  }>
}): BarPayload {
  const barItems = o.items.filter((item) => item.assignedArea === 'bar')
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    type: o.type,
    tableNumber: o.table?.number ?? undefined,
    isAdditional: o.isAdditional,
    parentOrderId: o.parentOrderId ?? undefined,
    notes: o.notes ?? undefined,
    createdAt: o.createdAt.toISOString(),
    items: barItems.map((item) => ({
      id: item.id,
      menuItemName: item.menuItem.name,
      quantity: item.quantity,
      notes: item.notes ?? undefined,
      status: item.status,
    })),
  }
}

const orderInclude = {
  items: {
    select: {
      id: true,
      quantity: true,
      notes: true,
      status: true,
      assignedArea: true,
      menuItem: { select: { name: true } },
    },
    orderBy: { status: 'asc' as const },
  },
  table: { select: { number: true } },
} as const

export async function barRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /bar/queue — cola activa de bebidas preparadas (sin auth: pantalla dedicada)
  fastify.get('/bar/queue', async (_request, reply) => {
    const orders = await prisma.order.findMany({
      where: {
        status: { notIn: ['delivered', 'cancelled'] },
        items: {
          some: {
            status: { notIn: ['served'] },
            assignedArea: 'bar',
          },
        },
      },
      include: orderInclude,
      orderBy: [{ isAdditional: 'asc' }, { createdAt: 'asc' }],
    })

    // TODO: tipar: cast necesario hasta que Prisma regenere con el schema actualizado
    return reply.status(200).send((orders as unknown as Parameters<typeof mapOrder>[0][]).map(mapOrder))
  })

  // GET /bar/ready — bebidas listas esperando al mesero
  fastify.get('/bar/ready', async (_request, reply) => {
    const orders = await prisma.order.findMany({
      where: {
        status: { notIn: ['delivered', 'cancelled'] },
        items: {
          none: {
            status: { in: ['pending', 'in_prep'] },
            assignedArea: 'bar',
          },
          some: {
            assignedArea: 'bar',
          },
        },
      },
      include: orderInclude,
      orderBy: [{ isAdditional: 'asc' }, { createdAt: 'asc' }],
    })

    // TODO: tipar: cast necesario hasta que Prisma regenere con el schema actualizado
    return reply.status(200).send((orders as unknown as Parameters<typeof mapOrder>[0][]).map(mapOrder))
  })
}
