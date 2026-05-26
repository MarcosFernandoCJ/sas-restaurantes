import jwt from 'jsonwebtoken'
import type { FastifyRequest, FastifyReply } from 'fastify'
import type { UserRole } from '@prisma/client'
import type { JwtPayload } from '../modules/auth/auth.types'

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret'

// Augmenta el tipo de FastifyRequest para que todas las rutas puedan leer request.user
declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload
  }
}

export function requireRole(roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      reply.status(401).send({ error: 'Unauthorized', message: 'Token requerido' })
      return
    }

    const token = authHeader.slice(7)

    let payload: JwtPayload
    try {
      payload = jwt.verify(token, JWT_SECRET) as JwtPayload
    } catch {
      reply.status(401).send({ error: 'Unauthorized', message: 'Token inválido o expirado' })
      return
    }

    if (payload.type !== 'access') {
      reply.status(401).send({ error: 'Unauthorized', message: 'Tipo de token incorrecto' })
      return
    }

    if (!roles.includes(payload.role)) {
      reply.status(403).send({ error: 'Forbidden', message: 'Permisos insuficientes' })
      return
    }

    request.user = payload
  }
}
