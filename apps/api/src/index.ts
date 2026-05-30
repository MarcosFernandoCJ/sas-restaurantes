import Fastify from 'fastify'
import { authRoutes } from './modules/auth/auth.routes'
import { ordersRoutes } from './modules/orders/orders.routes'
import { invoicesRoutes } from './modules/invoices/invoices.routes'
import { tablesRoutes } from './modules/tables/tables.routes'
import { menuRoutes } from './modules/menu/menu.routes'
import { kitchenRoutes } from './modules/kitchen/kitchen.routes'
import { barRoutes } from './modules/bar/bar.routes'
import { journeyRoutes } from './modules/journey/journey.routes'
import { adminRoutes } from './modules/admin/admin.routes'
import { devRoutes } from './modules/dev/dev.routes'
import { setupSocket } from './lib/socket'
import { startNotificationsWorker } from './modules/notifications/notifications.worker'

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
})

// Socket.io — initialized on the same HTTP server as Fastify
// Must be called before listen() so the WS server is ready when the first client connects
setupSocket(app.server)

// CORS
app.addHook('onRequest', async (request, reply) => {
  reply.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN ?? '*')
  reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  reply.header('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (request.method === 'OPTIONS') {
    reply.code(204).send()
  }
})

app.get('/health', async () => {
  return {
    message: 'Hello from API',
    status: 'ok',
    service: 'sas-api',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV ?? 'development',
  }
})

app.register(authRoutes)
app.register(ordersRoutes)
app.register(invoicesRoutes)
app.register(tablesRoutes)
app.register(menuRoutes)
app.register(kitchenRoutes)
app.register(barRoutes)
app.register(journeyRoutes)
app.register(adminRoutes)
app.register(devRoutes)

const start = async () => {
  try {
    const port = Number(process.env.PORT ?? 3001)
    await app.listen({ port, host: '0.0.0.0' })
    // Start BullMQ worker for pickup reminders (3-min re-notification if item not served)
    startNotificationsWorker()
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
