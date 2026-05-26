import type { FastifyInstance } from 'fastify'
import { requireRole } from '../../middleware/require-role'
import { ordersService } from './orders.service'
import { orderItemsRepository } from './order-items.repository'
import { emitToRoom } from '../../lib/socket'
import {
  createOrderSchema,
  updateOrderStatusSchema,
  addOrderItemsSchema,
  listOrdersQuerySchema,
  updateOrderItemSchema,
} from './orders.schema'

export async function ordersRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /orders — Crear un pedido con sus ítems
  // Status inicial: 'pending'. No entra a cocina hasta que la factura esté pagada.
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
        const order = await ordersService.createOrder({
          ...result.data,
          waiterId: request.user.sub,
        })
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

        emitToRoom('room:kitchen', 'order:item:updated', {
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
