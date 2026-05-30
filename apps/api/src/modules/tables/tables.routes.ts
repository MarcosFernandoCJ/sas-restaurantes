import type { FastifyInstance } from 'fastify'
import { requireRole } from '../../middleware/require-role'
import { prisma } from '../../lib/prisma'

export async function tablesRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /tables — Lista todas las mesas con TODOS sus pedidos activos.
  // Incluye assignedArea para que el mesero pueda distinguir ítems de cocina/bar/directo.
  // Retorna múltiples pedidos por mesa para mostrar adicionales correctamente.
  fastify.get(
    '/tables',
    { preHandler: requireRole(['admin', 'waiter', 'chef']) },
    async (_request, reply) => {
      const tables = await prisma.table.findMany({
        orderBy: { number: 'asc' },
        include: {
          orders: {
            where: { status: { in: ['pending', 'in_prep', 'ready'] } },
            select: {
              id: true,
              orderNumber: true,
              status: true,
              isAdditional: true,
              parentOrderId: true,
              createdAt: true,
              waiter: { select: { id: true, name: true } },
              items: {
                select: {
                  id: true,
                  status: true,
                  assignedArea: true,
                  menuItem: {
                    select: { name: true },
                  },
                },
              },
              invoice: {
                select: { id: true, status: true, total: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      })

      return reply.status(200).send(tables)
    }
  )
}
