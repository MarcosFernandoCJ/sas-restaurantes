import { journeyRepository } from './journey.repository'
import { prisma } from '../../lib/prisma'
import type { ItemBreakdownEntry } from './journey.types'

const BLOCKED_STATUSES = ['pending', 'in_prep'] as const

function makeError(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode })
}

export const journeyService = {
  async startJourney(adminId: string) {
    const open = await journeyRepository.findOpen()
    if (open) throw makeError('Ya hay una jornada abierta', 409)
    return journeyRepository.create(adminId)
  },

  async endJourney(adminId: string) {
    const open = await journeyRepository.findOpen()
    if (!open) throw makeError('No hay jornada activa', 404)

    const activeCount = await prisma.order.count({
      where: { status: { in: [...BLOCKED_STATUSES] } },
    })
    if (activeCount > 0) {
      throw makeError(
        `No se puede cerrar la jornada: hay ${activeCount} pedido${activeCount !== 1 ? 's' : ''} activo${activeCount !== 1 ? 's' : ''} pendiente${activeCount !== 1 ? 's' : ''}.`,
        409
      )
    }

    return journeyRepository.close(open.id, adminId)
  },

  async getCurrentSession() {
    return journeyRepository.findOpen()
  },

  async getSessionById(id: string) {
    const session = await journeyRepository.findById(id)
    if (!session) throw makeError('Jornada no encontrada', 404)
    return session
  },

  // Called incrementally every time an order is auto-delivered.
  // Writes metrics immediately — crash-safe approach:
  // if the server dies mid-shift, all completed orders are already persisted.
  async recordDeliveredOrder(orderId: string): Promise<void> {
    const session = await journeyRepository.findOpen()
    if (!session) return // No active journey — metrics not tracked

    // Load order with items, invoice, and category info for area filtering
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        invoice: { select: { total: true } },
        items: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!order || !order.invoice) return

    const revenue = Number(order.invoice.total)
    const deliveredHour = new Date().getHours()

    // Only count kitchen-managed items (assignedArea = 'kitchen') for prep metrics
    // TODO: tipar con DispatchArea una vez que el Prisma client regenere post-migración
    type OrderItemRaw = typeof order.items[number] & { assignedArea?: string }
    const kitchenItems = (order.items as OrderItemRaw[]).filter(
      (i) => (i.assignedArea ?? 'kitchen') === 'kitchen'
    )

    let totalPrepTimeSecs = 0
    let prepTimeCount = 0
    const itemBreakdownDelta: Record<string, ItemBreakdownEntry> = {}

    for (const item of kitchenItems) {
      const prepSecs =
        item.prepStartedAt && item.prepFinishedAt
          ? Math.round(
              (item.prepFinishedAt.getTime() - item.prepStartedAt.getTime()) / 1000
            )
          : 0

      if (prepSecs > 0) {
        totalPrepTimeSecs += prepSecs * item.quantity
        prepTimeCount += item.quantity
      }

      const prev = itemBreakdownDelta[item.menuItemId]
      itemBreakdownDelta[item.menuItemId] = prev
        ? {
            name: item.menuItem.name,
            count: prev.count + item.quantity,
            totalPrepSecs: prev.totalPrepSecs + prepSecs * item.quantity,
            totalRevenue: prev.totalRevenue,
          }
        : {
            name: item.menuItem.name,
            count: item.quantity,
            totalPrepSecs: prepSecs * item.quantity,
            totalRevenue: 0,
          }
    }

    // Revenue goes to the first food item for breakdown — simplification for MVP
    // In a real P&L split you'd prorate by item price
    const firstFoodKey = Object.keys(itemBreakdownDelta)[0]
    if (firstFoodKey) {
      itemBreakdownDelta[firstFoodKey].totalRevenue += revenue
    }

    await journeyRepository.upsertMetrics(session.id, {
      revenue,
      itemsPrepared: kitchenItems.reduce((s: number, i: OrderItemRaw) => s + i.quantity, 0),
      prepTimeSecs: prepTimeCount > 0 ? totalPrepTimeSecs : null,
      prepTimeCount,
      itemBreakdownDelta,
      deliveredHour,
    })
  },
}
