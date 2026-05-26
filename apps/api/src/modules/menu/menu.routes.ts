import type { FastifyInstance } from 'fastify'
import { requireRole } from '../../middleware/require-role'
import { prisma } from '../../lib/prisma'

export async function menuRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /menu-items — Lista platos/bebidas disponibles
  // Query: ?type=food|drink&available=true
  fastify.get(
    '/menu-items',
    { preHandler: requireRole(['admin', 'waiter', 'chef']) },
    async (request, reply) => {
      const { type, available } = request.query as { type?: string; available?: string }

      const items = await prisma.menuItem.findMany({
        where: {
          ...(available === 'true' ? { isAvailable: true } : {}),
          ...(type === 'food' ? { category: { type: 'food' } } : {}),
          ...(type === 'drink' ? { category: { type: 'drink' } } : {}),
        },
        include: {
          category: { select: { id: true, name: true, type: true } },
        },
        orderBy: [
          { category: { sortOrder: 'asc' } },
          { isFeatured: 'desc' },
          { name: 'asc' },
        ],
      })

      return reply.status(200).send(items)
    }
  )
}