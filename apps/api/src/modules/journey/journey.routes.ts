import type { FastifyInstance } from 'fastify'
import { requireRole } from '../../middleware/require-role'
import { journeyService } from './journey.service'
import { emitToRoom } from '../../lib/socket'
import { prisma } from '../../lib/prisma'

// Emits journey events to every room that cares about open/closed state.
// Kitchen display and waiter tablets both need to update their UI immediately.
function broadcastJourneyEvent(event: string, payload: unknown): void {
  emitToRoom('room:kitchen', event, payload)
  emitToRoom('room:waiters', event, payload)
  emitToRoom('room:admin', event, payload)
}

export async function journeyRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /journey/current — estado de jornada activa
  // Public: kitchen display (unauthenticated) and waiters both need this on mount.
  fastify.get('/journey/current', async (_request, reply) => {
    const session = await journeyService.getCurrentSession()
    return reply.status(200).send(session ?? null)
  })

  // POST /journey/start — abre jornada del día (solo admin)
  fastify.post(
    '/journey/start',
    { preHandler: requireRole(['admin']) },
    async (request, reply) => {
      try {
        const session = await journeyService.startJourney(request.user.sub)
        broadcastJourneyEvent('journey:started', {
          sessionId: session.id,
          startedAt: session.startedAt.toISOString(),
        })
        prisma.socketEvent.create({
          data: { type: 'SHIFT_OPENED', userId: request.user.sub, payload: { sessionId: session.id } },
        }).catch(() => { /* non-critical audit */ })
        return reply.status(201).send(session)
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // POST /journey/end — cierra jornada activa (solo admin)
  // Validates that no orders are pending or in_prep before closing.
  fastify.post(
    '/journey/end',
    { preHandler: requireRole(['admin']) },
    async (request, reply) => {
      try {
        const session = await journeyService.endJourney(request.user.sub)
        broadcastJourneyEvent('journey:ended', {
          sessionId: session.id,
          endedAt: session.endedAt?.toISOString(),
          metrics: session.metrics,
        })
        prisma.socketEvent.create({
          data: { type: 'SHIFT_CLOSED', userId: request.user.sub, payload: { sessionId: session.id } },
        }).catch(() => { /* non-critical audit */ })
        return reply.status(200).send(session)
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )

  // GET /journey/:id — métricas de una jornada (admin)
  fastify.get(
    '/journey/:id',
    { preHandler: requireRole(['admin']) },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string }
        const session = await journeyService.getSessionById(id)
        return reply.status(200).send(session)
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message: string }
        return reply.status(e.statusCode ?? 500).send({ error: e.message })
      }
    }
  )
}
