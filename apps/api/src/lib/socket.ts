import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import Redis from 'ioredis'
import jwt from 'jsonwebtoken'
import type { Server as HTTPServer } from 'http'

let io: Server | null = null

export function setupSocket(httpServer: HTTPServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN ?? '*',
      methods: ['GET', 'POST'],
    },
  })

  // Redis adapter — skipped in test env to avoid needing a real Redis instance
  if (process.env.NODE_ENV !== 'test') {
    const pubClient = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
    const subClient = pubClient.duplicate()
    io.adapter(createAdapter(pubClient, subClient))
  }

  // JWT auth at handshake — optional for kitchen display (PIN-based, no user account)
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) {
      socket.data.user = null
      return next()
    }

    try {
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET ?? 'dev_secret'
      ) as { sub: string; role: string; type: string }

      if (payload.type !== 'access') return next(new Error('Invalid token type'))
      socket.data.user = payload
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    const user = socket.data.user as { role: string; sub: string } | null

    // Auto-join rooms for authenticated users
    if (user) {
      if (user.role === 'chef') socket.join('room:kitchen')
      if (user.role === 'waiter') {
        socket.join(`room:waiter:${user.sub}`)
        socket.join('room:waiters') // broadcast room — all waiters receive journey/global events
      }
      if (user.role === 'admin') {
        socket.join('room:admin')
        socket.join('room:kitchen')
      }
    }

    // Allow unauthenticated clients (kitchen/bar display) to join via explicit event
    socket.on('join:room', (room: string) => {
      if (room === 'room:kitchen' || room === 'room:bar') socket.join(room)
    })

    // Register socket handlers for all connections.
    // Kitchen display connects without auth (PIN-based) but still needs item:ready.
    // The handler itself guards item:claim against null chefId.
    import('../modules/socket/socket.handler').then(({ registerSocketHandlers }) => {
      registerSocketHandlers(socket, io!)
    })
  })

  return io
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.io server not initialized')
  return io
}

// Null-safe emit helper — no-ops if io is not initialized (clean for service-layer unit tests)
export function emitToRoom(room: string, event: string, payload: unknown): void {
  io?.to(room).emit(event, payload)
}
