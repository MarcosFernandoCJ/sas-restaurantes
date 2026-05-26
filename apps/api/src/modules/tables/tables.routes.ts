import type { FastifyInstance } from 'fastify'
import { requireRole } from '../../middleware/require-role'
import { prisma } from '../../lib/prisma'

export async function tablesRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /tables — Lista todas las mesas con sus pedidos activos
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
              createdAt: true,
              items: {
                select: { id: true, status: true, menuItem: { select: { name: true } } },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      })

      return reply.status(200).send(tables)
    }
  )
}