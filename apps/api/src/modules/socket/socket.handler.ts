import type { Server, Socket } from 'socket.io'
import { orderItemsRepository } from '../orders/order-items.repository'
import { ordersService } from '../orders/orders.service'
import { pickupReminderQueue } from '../../lib/bullmq'

const REMINDER_DELAY_MS = 3 * 60 * 1000 // 3 minutes

export function registerSocketHandlers(socket: Socket, io: Server): void {
  // item:claim — chef claims an order item and begins preparation
  socket.on('item:claim', async (data: { itemId: string }) => {
    try {
      const chefId = (socket.data.user as { sub: string }).sub
      const item = await orderItemsRepository.claimItem(data.itemId, chefId)

      io.to('room:kitchen').emit('order:item:claimed', {
        itemId: item.id,
        orderId: item.orderId,
        chefId: item.assignedChef?.id ?? chefId,
        chefName: item.assignedChef?.name ?? null,
        status: item.status,
        orderNumber: item.order.orderNumber,
      })
    } catch {
      socket.emit('error', { event: 'item:claim', message: 'Error al reclamar el ítem' })
    }
  })

  // item:ready — chef marks item ready; notifies waiter and schedules pickup reminder
  socket.on('item:ready', async (data: { itemId: string }) => {
    try {
      const item = await orderItemsRepository.markItemReady(data.itemId)
      const waiterId = item.order.waiter.id

      const payload = {
        itemId: item.id,
        orderId: item.orderId,
        menuItemName: item.menuItem.name,
        tableId: item.order.table?.id ?? null,
        tableNumber: item.order.table?.number ?? null,
        orderNumber: item.order.orderNumber,
        waiterId,
      }

      io.to(`room:waiter:${waiterId}`).emit('order:item:ready', payload)

      // Schedule reminder: re-notify waiter after 3 min if item not yet served
      await pickupReminderQueue.add(
        'reminder',
        { itemId: item.id, waiterId, payload },
        {
          delay: REMINDER_DELAY_MS,
          jobId: `reminder-${item.id}`, // deduplicated — only one reminder per item
        }
      )
    } catch {
      socket.emit('error', { event: 'item:ready', message: 'Error al marcar el ítem como listo' })
    }
  })

  // item:served — waiter confirms delivery; cancels reminder and triggers auto-deliver check
  socket.on('item:served', async (data: { itemId: string }) => {
    try {
      const item = await orderItemsRepository.markItemServed(data.itemId)
      await ordersService.checkAndAutoDeliver(item.orderId)

      // Cancel the pending reminder job for this item (if it hasn't fired yet)
      const job = await pickupReminderQueue.getJob(`reminder-${item.id}`)
      if (job) await job.remove()
    } catch {
      socket.emit('error', { event: 'item:served', message: 'Error al marcar el ítem como servido' })
    }
  })
}