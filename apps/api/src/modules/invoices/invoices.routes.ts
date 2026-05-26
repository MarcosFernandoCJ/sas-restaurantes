import type { FastifyInstance } from 'fastify'
import { requireRole } from '../../middleware/require-role'
import { invoicesService } from './invoices.service'
import { createInvoiceSchema, payInvoiceSchema } from './invoices.schema'

export async function invoicesRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /invoices — Crear factura para un pedido (status inicial: 'pending')
  fastify.post(
    '/invoices',
    { preHandler: requireRole(['admin', 'waiter']) },
    async (request, reply) => {
      const result = createInvoiceSchema.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({
          error: 'Validation error',
          details: result.error.flatten().fieldErrors,
        })
      }

      try {
        const invoice = await invoicesService.createInvoice(result.data)
        return reply.status(201).send(invoice)
      } catch (err: unknown) {
        const e = err as { message: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // GET /invoices/:id — Detalle de una factura
  fastify.get(
    '/invoices/:id',
    { preHandler: requireRole(['admin', 'waiter']) },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      try {
        const invoice = await invoicesService.getInvoiceById(id)
        return reply.status(200).send(invoice)
      } catch (err: unknown) {
        const e = err as { message: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // POST /invoices/:id/pay — Confirmar pago → emite order:created o order:additional a room:kitchen
  // REGLA CRÍTICA: solo funciona si invoice.status === 'pending'
  fastify.post(
    '/invoices/:id/pay',
    { preHandler: requireRole(['admin', 'waiter']) },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const result = payInvoiceSchema.safeParse(request.body)
      if (!result.success) {
        return reply.status(400).send({
          error: 'Validation error',
          details: result.error.flatten().fieldErrors,
        })
      }

      try {
        const invoice = await invoicesService.payInvoice(id, result.data)
        return reply.status(200).send(invoice)
      } catch (err: unknown) {
        const e = err as { message: string; statusCode?: number }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )
}
