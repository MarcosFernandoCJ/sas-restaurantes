import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import type { ItemBreakdownEntry, HourlyEntry } from './journey.types'

export const journeyRepository = {
  async findOpen() {
    return prisma.journeySession.findFirst({
      where: { status: 'open' },
      include: { metrics: true },
      orderBy: { startedAt: 'desc' },
    })
  },

  async findById(id: string) {
    return prisma.journeySession.findUnique({
      where: { id },
      include: { metrics: true, startedBy: { select: { id: true, name: true } } },
    })
  },

  async create(startedById: string) {
    return prisma.journeySession.create({
      data: {
        startedById,
        metrics: {
          create: {
            itemBreakdown: {},
            hourlyBreakdown: {},
          },
        },
      },
      include: { metrics: true },
    })
  },

  async close(id: string, endedById: string) {
    return prisma.journeySession.update({
      where: { id },
      data: { status: 'closed', endedAt: new Date(), endedById },
      include: { metrics: true },
    })
  },

  // Incrementally update metrics when an order is delivered.
  // Uses raw JSON merge to avoid race conditions on the Json columns.
  async upsertMetrics(
    sessionId: string,
    delta: {
      revenue: number
      itemsPrepared: number
      prepTimeSecs: number | null      // null = no timing data for this item
      prepTimeCount: number            // how many timed items in this order
      itemBreakdownDelta: Record<string, ItemBreakdownEntry>
      deliveredHour: number            // 0-23
    }
  ) {
    const current = await prisma.journeyMetrics.findUnique({ where: { sessionId } })
    if (!current) return

    const prevBreakdown = (current.itemBreakdown as unknown as Record<string, ItemBreakdownEntry>) ?? {}
    const prevHourly = (current.hourlyBreakdown as unknown as Record<string, HourlyEntry>) ?? {}

    // Merge item breakdown
    const mergedBreakdown: Record<string, ItemBreakdownEntry> = { ...prevBreakdown }
    for (const [menuItemId, entry] of Object.entries(delta.itemBreakdownDelta)) {
      const prev = mergedBreakdown[menuItemId]
      mergedBreakdown[menuItemId] = prev
        ? {
            name: entry.name,
            count: prev.count + entry.count,
            totalPrepSecs: prev.totalPrepSecs + entry.totalPrepSecs,
            totalRevenue: prev.totalRevenue + entry.totalRevenue,
          }
        : entry
    }

    // Merge hourly breakdown
    const hourKey = String(delta.deliveredHour)
    const prevHour = prevHourly[hourKey] ?? { orders: 0, revenue: 0 }
    const mergedHourly: Record<string, HourlyEntry> = {
      ...prevHourly,
      [hourKey]: {
        orders: prevHour.orders + 1,
        revenue: prevHour.revenue + delta.revenue,
      },
    }

    // Rolling average for prep time
    const totalCount = current.prepTimeCount + delta.prepTimeCount
    let newAvg = current.avgPrepTimeSecs
    if (delta.prepTimeSecs !== null && delta.prepTimeCount > 0) {
      const prevTotal = current.avgPrepTimeSecs * current.prepTimeCount
      newAvg = Math.round((prevTotal + delta.prepTimeSecs) / totalCount)
    }

    await prisma.journeyMetrics.update({
      where: { sessionId },
      data: {
        ordersCompleted: { increment: 1 },
        itemsPrepared: { increment: delta.itemsPrepared },
        totalRevenue: { increment: delta.revenue },
        avgPrepTimeSecs: newAvg,
        prepTimeCount: totalCount,
        itemBreakdown: mergedBreakdown as unknown as Prisma.JsonObject,
        hourlyBreakdown: mergedHourly as unknown as Prisma.JsonObject,
      },
    })
  },
}
