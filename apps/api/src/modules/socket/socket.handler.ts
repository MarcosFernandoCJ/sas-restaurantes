import type { Server, Socket } from 'socket.io'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { orderItemsRepository } from '../orders/order-items.repository'
import { ordersService } from '../orders/orders.service'
import { journeyService } from '../journey/journey.service'
import { pickupReminderQueue } from '../../lib/bullmq'

const REMINDER_DELAY_MS = 3 * 60 * 1000 // 3 min

// Returns the socket room for a given assignedArea.
// bar items go to room:bar; everything else (kitchen, waiter-direct) goes to room:kitchen.
function roomForArea(assignedArea: string): string {
  return assignedArea === 'bar' ? 'room:bar' : 'room:kitchen'
}

// Checks if all items handled by kitchen or bar are ready/served.
// Used to determine when a delivery order should notify the waiter to pack.
async function allProductionItemsReady(orderId: string): Promise<boolean> {
  const items = await prisma.orderItem.findMany({
    where: {
      orderId,
      assignedArea: { in: ['kitchen', 'bar'] },
    },
    select: { status: true },
  })
  return (
    items.length > 0 &&
    items.every((i: { status: string }) => i.status === 'ready' || i.status === 'served')
  )
}

// TODO: tipar con SocketEventType una vez que Prisma regenere post-migración
type SocketEventTypeLiteral = string

// Fire-and-forget audit log — never blocks the event flow.
function logSocketEvent(
  type: SocketEventTypeLiteral,
  ctx: { orderId?: string; itemId?: string; userId?: string; payload?: Record<string, unknown> }
): void {
  // TODO: tipar — prisma.socketEvent existe post-migración, cast necesario hasta entonces
  const db = prisma as unknown as {
    socketEvent: { create: (args: { data: unknown }) => Promise<unknown> }
  }
  db.socketEvent
    .create({
      data: {
        type,
        orderId: ctx.orderId ?? null,
        itemId: ctx.itemId ?? null,
        userId: ctx.userId ?? null,
        payload: (ctx.payload ?? {}) as unknown as Prisma.InputJsonValue,
      },
    })
    .catch(() => { /* audit failure never blocks order flow */ })
}

export function registerSocketHandlers(socket: Socket, io: Server): void {
  const chefId: string | null = (socket.data.user as { sub: string } | null)?.sub ?? null

  // item:claim — kitchen/bar staff claims an item (transitions to in_prep).
  socket.on('item:claim', async (data: { itemId: string }) => {
    try {
      const item = await orderItemsRepository.claimItem(data.itemId, chefId)
      const assignedArea = (item as unknown as { assignedArea: string }).assignedArea ?? 'kitchen'
      const targetRoom = roomForArea(assignedArea)

      io.to(targetRoom).emit('order:item:claimed', {
        itemId: item.id,
        orderId: item.orderId,
        chefId: item.assignedChef?.id ?? chefId,
        chefName: item.assignedChef?.name ?? null,
        status: item.status,
        orderNumber: item.order.orderNumber,
      })
      logSocketEvent('ITEM_STARTED', {
        itemId: item.id,
        orderId: item.orderId,
        userId: chefId ?? undefined,
        payload: { orderNumber: item.order.orderNumber, area: assignedArea },
      })
      if (item.order.table?.id) {
        io.to(`room:waiter:${item.order.waiter.id}`).emit('table:updated', {
          tableId: item.order.table.id,
          orderId: item.orderId,
        })
      }
    } catch {
      socket.emit('error', { event: 'item:claim', message: 'Error al reclamar el ítem' })
    }
  })

  // item:ready — kitchen/bar staff marks an item as ready.
  // Auto-claims if still pending. Notifies waiter per-item (dine_in) or when all
  // production items are ready (delivery).
  socket.on('item:ready', async (data: { itemId: string }) => {
    try {
      const existing = await orderItemsRepository.findById(data.itemId)
      if (!existing) {
        return socket.emit('error', { event: 'item:ready', message: 'Ítem no encontrado' })
      }
      if (existing.status === 'ready' || existing.status === 'served') {
        return // idempotent — already done
      }

      const existingArea = (existing as unknown as { assignedArea: string }).assignedArea ?? 'kitchen'
      const targetRoom = roomForArea(existingArea)

      // Auto-claim if still pending
      if (existing.status === 'pending') {
        await orderItemsRepository.claimItem(data.itemId, chefId)
        io.to(targetRoom).emit('order:item:claimed', {
          itemId: existing.id,
          orderId: existing.orderId,
          chefId,
          chefName: chefId ? (existing.assignedChef?.name ?? null) : null,
          status: 'in_prep',
          orderNumber: existing.order.orderNumber,
          autoClaimed: true,
        })
        if (existing.order.table?.id) {
          io.to(`room:waiter:${existing.order.waiter.id}`).emit('table:updated', {
            tableId: existing.order.table.id,
            orderId: existing.orderId,
          })
        }
      }

      const item = await orderItemsRepository.markItemReady(data.itemId)
      const itemArea = (item as unknown as { assignedArea: string }).assignedArea ?? 'kitchen'
      const itemRoom = roomForArea(itemArea)
      const waiterId = item.order.waiter.id
      const orderType = item.order.type

      logSocketEvent('ITEM_READY', {
        itemId: item.id,
        orderId: item.orderId,
        userId: chefId ?? undefined,
        payload: { orderNumber: item.order.orderNumber, area: itemArea },
      })

      // Emit to the station's room so the card can dim the ready item
      io.to(itemRoom).emit('order:item:ready', {
        itemId: item.id,
        orderId: item.orderId,
        orderNumber: item.order.orderNumber,
      })

      // Emit table:updated so waiter's TableDetail re-fetches
      if (item.order.table?.id) {
        io.to(`room:waiter:${waiterId}`).emit('table:updated', {
          tableId: item.order.table.id,
          orderId: item.orderId,
        })
      }

      if (orderType === 'delivery') {
        const ready = await allProductionItemsReady(item.orderId)
        if (ready) {
          io.to(`room:waiter:${waiterId}`).emit('order:ready', {
            orderId: item.orderId,
            orderNumber: item.order.orderNumber,
            isDelivery: true,
          })
        }
      } else {
        // Dine-in: notify waiter immediately per item
        const waiterPayload = {
          itemId: item.id,
          orderId: item.orderId,
          menuItemName: item.menuItem.name,
          tableId: item.order.table?.id ?? null,
          tableNumber: item.order.table?.number ?? null,
          orderNumber: item.order.orderNumber,
          waiterId,
        }
        io.to(`room:waiter:${waiterId}`).emit('order:item:ready', waiterPayload)

        logSocketEvent('WAITER_NOTIFIED', {
          itemId: item.id,
          orderId: item.orderId,
          userId: waiterId,
          payload: { orderNumber: item.order.orderNumber },
        })
        orderItemsRepository.setNotifiedAt(item.id).catch(() => { /* non-critical */ })

        await pickupReminderQueue.add(
          'reminder',
          { itemId: item.id, waiterId, payload: waiterPayload },
          {
            delay: REMINDER_DELAY_MS,
            jobId: `reminder-${item.id}`,
          }
        )
      }
    } catch {
      socket.emit('error', { event: 'item:ready', message: 'Error al marcar el ítem como listo' })
    }
  })

  // item:served — waiter confirms delivery of a specific item.
  socket.on('item:served', async (data: { itemId: string }) => {
    try {
      const item = await orderItemsRepository.markItemServed(data.itemId)
      logSocketEvent('ITEM_DELIVERED', {
        itemId: item.id,
        orderId: item.orderId,
        userId: chefId ?? undefined,
      })
      const wasDelivered = await ordersService.checkAndAutoDeliver(item.orderId)

      if (wasDelivered) {
        io.to('room:kitchen').emit('order:delivered', { orderId: item.orderId })
        io.to('room:bar').emit('order:delivered', { orderId: item.orderId })
        journeyService.recordDeliveredOrder(item.orderId).catch(() => {})
      }

      const job = await pickupReminderQueue.getJob(`reminder-${item.id}`)
      if (job) await job.remove()
    } catch {
      socket.emit('error', { event: 'item:served', message: 'Error al marcar el ítem como servido' })
    }
  })
}
