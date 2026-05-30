import type { FastifyInstance } from 'fastify'
import { requireRole } from '../../middleware/require-role'
import { ordersService } from './orders.service'
import { orderItemsRepository } from './order-items.repository'
import { journeyRepository } from '../journey/journey.repository'
import { emitToRoom } from '../../lib/socket'
import { prisma } from '../../lib/prisma'
import {
  createOrderSchema,
  updateOrderStatusSchema,
  addOrderItemsSchema,
  listOrdersQuerySchema,
  updateOrderItemSchema,
} from './orders.schema'

// Items from an order that carry dispatchArea info (post prisma-generate type)
type DispatchItem = {
  id: string
  quantity: number
  notes: string | null
  status: string
  assignedArea: string
  menuItem: { name: string }
}

function buildAreaPayload(
  order: {
    id: string
    orderNumber: number
    type: string
    isAdditional: boolean
    parentOrderId: string | null
    notes: string | null
    createdAt: Date
    table: { number: number } | null
  },
  items: DispatchItem[]
) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    type: order.type as 'dine_in' | 'delivery',
    tableNumber: order.table?.number ?? undefined,
    isAdditional: order.isAdditional,
    parentOrderId: order.parentOrderId ?? undefined,
    notes: order.notes ?? undefined,
    createdAt: order.createdAt.toISOString(),
    items: items.map((item) => ({
      id: item.id,
      menuItemName: item.menuItem.name,
      quantity: item.quantity,
      notes: item.notes ?? undefined,
      status: item.status as 'pending' | 'in_prep' | 'ready' | 'served',
    })),
  }
}

function dispatchOrderToAreas(
  order: Parameters<typeof buildAreaPayload>[0] & { items: unknown[] },
  waiterId: string
): void {
  const allItems = order.items as unknown as DispatchItem[]
  const kitchenItems = allItems.filter((i) => i.assignedArea === 'kitchen')
  const barItems = allItems.filter((i) => i.assignedArea === 'bar')

  const event = order.isAdditional ? 'order:additional' : 'order:created'

  if (kitchenItems.length > 0) {
    emitToRoom('room:kitchen', event, buildAreaPayload(order, kitchenItems))
  }
  if (barItems.length > 0) {
    emitToRoom('room:bar', event, buildAreaPayload(order, barItems))
  }

  // Waiter room — always notify so TableDetail refreshes
  const tableId = order.table ? (order as unknown as { table: { id?: string } }).table?.id : null
  if (tableId) {
    emitToRoom(`room:waiter:${waiterId}`, 'table:updated', {
      tableId,
      orderId: order.id,
    })
  }

  // Fire-and-forget audit log
  // TODO: tipar — socketEvent y SocketEventType existen post-migración
  const db = prisma as unknown as {
    socketEvent: { create: (args: { data: unknown }) => Promise<unknown> }
  }
  db.socketEvent
    .create({
      data: {
        type: order.isAdditional ? 'ADDITIONAL_ORDER_CREATED' : 'ORDER_CREATED',
        orderId: order.id,
        userId: waiterId,
        payload: { orderNumber: order.orderNumber },
      },
    })
    .catch(() => {})
}

export async function ordersRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /orders — Crear un pedido con sus ítems.
  // El pedido se despacha inmediatamente a cocina/bar según assignedArea de cada ítem.
  // El pago es una operación financiera separada y no bloquea el despacho operativo.
  fastify.post(
    '/orders',
    { preHandler: requireRole(['admin', 'waiter']) },
    async (request, reply) => {
      const result = createOrderSchema.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({
          error: 'Validation error',
          details: result.error.flatten().fieldErrors,
        })
      }

      try {
        const session = await journeyRepository.findOpen()
        if (!session) {
          return reply.status(403).send({
            error: 'Jornada no iniciada',
            message: 'El local no ha iniciado jornada. Contacta al administrador.',
          })
        }

        const order = await ordersService.createOrder({
          ...result.data,
          waiterId: request.user.sub,
        })

        // Dispatch immediately to kitchen/bar — payment status is irrelevant
        dispatchOrderToAreas(order as Parameters<typeof dispatchOrderToAreas>[0], request.user.sub)

        return reply.status(201).send(order)
      } catch (err: unknown) {
        const e = err as { message: string; statusCode?: number }
        request.log.error({ msg: 'Error creating order', error: e.message })
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // GET /orders — Listar pedidos con filtros y paginación
  fastify.get(
    '/orders',
    { preHandler: requireRole(['admin', 'waiter', 'chef']) },
    async (request, reply) => {
      const result = listOrdersQuerySchema.safeParse(request.query)
      if (!result.success) {
        return reply.status(400).send({
          error: 'Validation error',
          details: result.error.flatten().fieldErrors,
        })
      }

      try {
        const response = await ordersService.listOrders(result.data)
        return reply.status(200).send(response)
      } catch (err: unknown) {
        const e = err as { message: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // GET /orders/:id — Detalle granular del pedido
  fastify.get(
    '/orders/:id',
    { preHandler: requireRole(['admin', 'waiter', 'chef']) },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      try {
        const order = await ordersService.getOrderById(id)
        return reply.status(200).send(order)
      } catch (err: unknown) {
        const e = err as { message: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // PATCH /orders/:id/status — Cambiar el estado global del pedido
  fastify.patch(
    '/orders/:id/status',
    { preHandler: requireRole(['admin', 'waiter', 'chef']) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const result = updateOrderStatusSchema.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({
          error: 'Validation error',
          details: result.error.flatten().fieldErrors,
        })
      }

      try {
        const order = await ordersService.updateOrderStatus(id, result.data)
        return reply.status(200).send(order)
      } catch (err: unknown) {
        const e = err as { message: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // POST /orders/:id/items — Agregar ítems a un pedido existente
  fastify.post(
    '/orders/:id/items',
    { preHandler: requireRole(['admin', 'waiter']) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const result = addOrderItemsSchema.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({
          error: 'Validation error',
          details: result.error.flatten().fieldErrors,
        })
      }

      try {
        const order = await ordersService.addItemsToOrder(id, result.data)
        return reply.status(200).send(order)
      } catch (err: unknown) {
        const e = err as { message: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // PATCH /orders/:orderId/items/:itemId — Mesero edita notas de un ítem en preparación
  // Emite order:item:updated a room:kitchen para que el cocinero vea el badge "ACTUALIZADO"
  fastify.patch(
    '/orders/:orderId/items/:itemId',
    { preHandler: requireRole(['admin', 'waiter']) },
    async (request, reply) => {
      const { orderId, itemId } = request.params as { orderId: string; itemId: string }
      const result = updateOrderItemSchema.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({
          error: 'Validation error',
          details: result.error.flatten().fieldErrors,
        })
      }

      try {
        const existing = await orderItemsRepository.findById(itemId)
        if (!existing || existing.orderId !== orderId) {
          return reply.status(404).send({ error: 'Ítem no encontrado' })
        }

        const updated = await orderItemsRepository.updateNotes(itemId, result.data.notes)
        const assignedArea = (existing as unknown as { assignedArea: string }).assignedArea ?? 'kitchen'
        const targetRoom = assignedArea === 'bar' ? 'room:bar' : 'room:kitchen'

        emitToRoom(targetRoom, 'order:item:updated', {
          itemId: updated.id,
          orderId: updated.orderId,
          notes: updated.notes,
        })

        return reply.status(200).send(updated)
      } catch (err: unknown) {
        const e = err as { message: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )
}
