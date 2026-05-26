import type { FastifyInstance } from 'fastify'
import { authService } from './auth.service'
import { loginSchema, refreshSchema, logoutSchema } from './auth.schema'

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/auth/login', async (request, reply) => {
    const result = loginSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: result.error.flatten().fieldErrors,
      })
    }

    try {
      const data = await authService.login(result.data)
      return reply.status(200).send(data)
    } catch (err: unknown) {
      const e = err as { message: string; statusCode?: number }
      request.log.warn({ msg: 'Login failed', email: result.data.email })
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  fastify.post('/auth/refresh', async (request, reply) => {
    const result = refreshSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: result.error.flatten().fieldErrors,
      })
    }

    try {
      const data = await authService.refresh(result.data)
      return reply.status(200).send(data)
    } catch (err: unknown) {
      const e = err as { message: string; statusCode?: number }
      return reply.status(e.statusCode ?? 500).send({ error: e.message })
    }
  })

  fastify.post('/auth/logout', async (request, reply) => {
    const result = logoutSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({
        error: 'Validation error',
        details: result.error.flatten().fieldErrors,
      })
    }

    await authService.logout(result.data.refreshToken)
    return reply.status(204).send()
  })
}
