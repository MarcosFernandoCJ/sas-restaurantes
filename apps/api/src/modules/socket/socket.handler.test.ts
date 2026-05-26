import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client'
import jwt from 'jsonwebtoken'
import { registerSocketHandlers } from './socket.handler'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../orders/order-items.repository', () => ({
  orderItemsRepository: {
    claimItem: vi.fn(),
    markItemReady: vi.fn(),
    markItemServed: vi.fn(),
  },
}))

vi.mock('../orders/orders.service', () => ({
  ordersService: {
    checkAndAutoDeliver: vi.fn(),
  },
}))

import { orderItemsRepository } from '../orders/order-items.repository'
import { ordersService } from '../orders/orders.service'

// ── Helpers ────────────────────────────────────────────────────────────────────

const JWT_SECRET = 'test_secret'

function makeToken(role: 'chef' | 'waiter' | 'admin', userId = 'user-1') {
  return jwt.sign({ sub: userId, role, type: 'access' }, JWT_SECRET, { expiresIn: '15m' })
}

function waitForEvent<T>(socket: ClientSocket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout: evento '${event}' no recibido en ${timeoutMs}ms`)),
      timeoutMs
    )
    socket.once(event, (data: T) => {
      clearTimeout(timer)
      resolve(data)
    })
  })
}

// ── Test server factory ────────────────────────────────────────────────────────

interface TestServer {
  io: Server
  port: number
  close: () => Promise<void>
}

function createTestServer(): Promise<TestServer> {
  return new Promise((resolve) => {
    const httpServer = createServer()
    const io = new Server(httpServer, { transports: ['websocket'] })

    // Simplified JWT auth (same logic as lib/socket.ts, isolated for tests)
    io.use((socket, next) => {
      const token = socket.handshake.auth?.token as string | undefined
      if (!token) return next(new Error('Authentication required'))
      try {
        const payload = jwt.verify(token, JWT_SECRET) as {
          sub: string
          role: string
          type: string
        }
        if (payload.type !== 'access') return next(new Error('Invalid token type'))
        socket.data.user = payload
        next()
      } catch {
        next(new Error('Invalid token'))
      }
    })

    io.on('connection', (socket) => {
      const { role, sub } = socket.data.user as { role: string; sub: string }
      if (role === 'chef') socket.join('room:kitchen')
      if (role === 'waiter') socket.join(`room:waiter:${sub}`)
      if (role === 'admin') {
        socket.join('room:admin')
        socket.join('room:kitchen')
      }
      registerSocketHandlers(socket, io)
    })

    httpServer.listen(0, () => {
      const addr = httpServer.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      resolve({
        io,
        port,
        close: () =>
          new Promise((res) => {
            io.close()
            httpServer.close(() => res())
          }),
      })
    })
  })
}

function connectClient(
  port: number,
  role: 'chef' | 'waiter' | 'admin',
  userId = 'user-1'
): ClientSocket {
  return ioc(`http://localhost:${port}`, {
    transports: ['websocket'],
    auth: { token: makeToken(role, userId) },
  })
}

function waitForConnect(socket: ClientSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.on('connect', resolve)
    socket.on('connect_error', reject)
  })
}

// ── Fixtures ───────────────────────────────────────────────────────────────────

const mockClaimedItem = {
  id: 'item-1',
  orderId: 'order-1',
  status: 'in_prep' as const,
  assignedChef: { id: 'chef-1', name: 'Carlos' },
  order: {
    orderNumber: 42,
    waiter: { id: 'waiter-1', name: 'Juan' },
    table: { id: 'table-1', number: 5 },
  },
  menuItem: { id: 'menu-1', name: 'Pollo a la brasa' },
}

const mockReadyItem = {
  id: 'item-1',
  orderId: 'order-1',
  status: 'ready' as const,
  assignedChef: null,
  order: {
    orderNumber: 42,
    waiter: { id: 'waiter-1', name: 'Juan' },
    table: { id: 'table-1', number: 5 },
  },
  menuItem: { id: 'menu-1', name: 'Pollo a la brasa' },
}

const mockServedItem = {
  id: 'item-1',
  orderId: 'order-1',
  status: 'served' as const,
}

// ── Tests: Autenticación en el handshake ───────────────────────────────────────

describe('WebSocket — autenticación en el handshake', () => {
  let server: TestServer

  beforeEach(async () => {
    server = await createTestServer()
  })

  afterEach(async () => {
    await server.close()
  })

  it('rechaza la conexión sin token', async () => {
    const client = ioc(`http://localhost:${server.port}`, {
      transports: ['websocket'],
      auth: {},
    })
    await expect(waitForConnect(client)).rejects.toThrow()
    client.disconnect()
  })

  it('rechaza la conexión con un JWT firmado con otro secret', async () => {
    const badToken = jwt.sign({ sub: 'u', role: 'chef', type: 'access' }, 'wrong_secret')
    const client = ioc(`http://localhost:${server.port}`, {
      transports: ['websocket'],
      auth: { token: badToken },
    })
    await expect(waitForConnect(client)).rejects.toThrow()
    client.disconnect()
  })

  it('rechaza la conexión con un refresh token (type !== access)', async () => {
    const refreshToken = jwt.sign({ sub: 'u', role: 'chef', type: 'refresh' }, JWT_SECRET)
    const client = ioc(`http://localhost:${server.port}`, {
      transports: ['websocket'],
      auth: { token: refreshToken },
    })
    await expect(waitForConnect(client)).rejects.toThrow()
    client.disconnect()
  })

  it('acepta la conexión con un access token válido', async () => {
    const client = connectClient(server.port, 'chef', 'chef-1')
    await expect(waitForConnect(client)).resolves.toBeUndefined()
    client.disconnect()
  })
})

// ── Tests: Asignación de rooms por rol ─────────────────────────────────────────

describe('WebSocket — rooms por rol', () => {
  let server: TestServer
  let chefClient: ClientSocket
  let waiterClient: ClientSocket
  let adminClient: ClientSocket

  beforeEach(async () => {
    vi.clearAllMocks()
    server = await createTestServer()
    chefClient = connectClient(server.port, 'chef', 'chef-1')
    waiterClient = connectClient(server.port, 'waiter', 'waiter-1')
    adminClient = connectClient(server.port, 'admin', 'admin-1')
    await Promise.all([
      waitForConnect(chefClient),
      waitForConnect(waiterClient),
      waitForConnect(adminClient),
    ])
  })

  afterEach(async () => {
    chefClient.disconnect()
    waiterClient.disconnect()
    adminClient.disconnect()
    await server.close()
  })

  it('chef recibe eventos emitidos a room:kitchen', async () => {
    const received = waitForEvent<{ msg: string }>(chefClient, 'test:kitchen')
    server.io.to('room:kitchen').emit('test:kitchen', { msg: 'hola cocina' })
    expect((await received).msg).toBe('hola cocina')
  })

  it('waiter recibe eventos emitidos a su room:waiter:{id}', async () => {
    const received = waitForEvent<{ msg: string }>(waiterClient, 'test:waiter')
    server.io.to('room:waiter:waiter-1').emit('test:waiter', { msg: 'hola mesero' })
    expect((await received).msg).toBe('hola mesero')
  })

  it('waiter NO recibe eventos emitidos al room del otro mesero', async () => {
    const waiter2 = connectClient(server.port, 'waiter', 'waiter-2')
    await waitForConnect(waiter2)

    let received = false
    waiterClient.on('test:other', () => { received = true })
    server.io.to('room:waiter:waiter-2').emit('test:other', {})

    await new Promise((r) => setTimeout(r, 200))
    expect(received).toBe(false)
    waiter2.disconnect()
  })

  it('admin recibe eventos emitidos a room:kitchen Y room:admin', async () => {
    const [kitchenEvt, adminEvt] = await Promise.all([
      waitForEvent<{ msg: string }>(adminClient, 'test:kitchen2'),
      waitForEvent<{ msg: string }>(adminClient, 'test:admin'),
      (async () => {
        server.io.to('room:kitchen').emit('test:kitchen2', { msg: 'from kitchen' })
        server.io.to('room:admin').emit('test:admin', { msg: 'from admin' })
      })(),
    ])
    expect(kitchenEvt.msg).toBe('from kitchen')
    expect(adminEvt.msg).toBe('from admin')
  })
})

// ── Tests: item:claim → order:item:claimed ─────────────────────────────────────

describe('item:claim → order:item:claimed', () => {
  let server: TestServer
  let chefClient: ClientSocket
  let kitchenObserver: ClientSocket

  beforeEach(async () => {
    vi.clearAllMocks()
    server = await createTestServer()
    chefClient = connectClient(server.port, 'chef', 'chef-1')
    kitchenObserver = connectClient(server.port, 'chef', 'chef-2')
    await Promise.all([waitForConnect(chefClient), waitForConnect(kitchenObserver)])
  })

  afterEach(async () => {
    chefClient.disconnect()
    kitchenObserver.disconnect()
    await server.close()
  })

  it('emite order:item:claimed a room:kitchen cuando el cocinero reclama un ítem', async () => {
    vi.mocked(orderItemsRepository.claimItem).mockResolvedValue(mockClaimedItem as any)

    const claimedPromise = waitForEvent<Record<string, unknown>>(kitchenObserver, 'order:item:claimed')
    chefClient.emit('item:claim', { itemId: 'item-1' })

    const payload = await claimedPromise
    expect(payload.itemId).toBe('item-1')
    expect(payload.orderId).toBe('order-1')
    expect(payload.status).toBe('in_prep')
    expect(payload.chefId).toBe('chef-1')
    expect(payload.orderNumber).toBe(42)
  })

  it('llama a claimItem con el chefId del JWT (no del payload)', async () => {
    vi.mocked(orderItemsRepository.claimItem).mockResolvedValue(mockClaimedItem as any)

    const claimedPromise = waitForEvent(kitchenObserver, 'order:item:claimed')
    chefClient.emit('item:claim', { itemId: 'item-1' })
    await claimedPromise

    expect(orderItemsRepository.claimItem).toHaveBeenCalledWith('item-1', 'chef-1')
  })

  it('emite error al socket si claimItem falla', async () => {
    vi.mocked(orderItemsRepository.claimItem).mockRejectedValue(new Error('DB error'))

    const errorPromise = waitForEvent<{ event: string }>(chefClient, 'error')
    chefClient.emit('item:claim', { itemId: 'nonexistent' })

    const err = await errorPromise
    expect(err.event).toBe('item:claim')
  })
})

// ── Tests: item:ready → order:item:ready ───────────────────────────────────────

describe('item:ready → order:item:ready', () => {
  let server: TestServer
  let chefClient: ClientSocket
  let waiterClient: ClientSocket
  let otherWaiterClient: ClientSocket

  beforeEach(async () => {
    vi.clearAllMocks()
    server = await createTestServer()
    chefClient = connectClient(server.port, 'chef', 'chef-1')
    waiterClient = connectClient(server.port, 'waiter', 'waiter-1') // owns the order
    otherWaiterClient = connectClient(server.port, 'waiter', 'waiter-2')
    await Promise.all([
      waitForConnect(chefClient),
      waitForConnect(waiterClient),
      waitForConnect(otherWaiterClient),
    ])
  })

  afterEach(async () => {
    chefClient.disconnect()
    waiterClient.disconnect()
    otherWaiterClient.disconnect()
    await server.close()
  })

  it('notifica al mesero correcto con order:item:ready', async () => {
    vi.mocked(orderItemsRepository.markItemReady).mockResolvedValue(mockReadyItem as any)

    const readyPromise = waitForEvent<Record<string, unknown>>(waiterClient, 'order:item:ready')
    chefClient.emit('item:ready', { itemId: 'item-1' })

    const payload = await readyPromise
    expect(payload.itemId).toBe('item-1')
    expect(payload.menuItemName).toBe('Pollo a la brasa')
    expect(payload.tableNumber).toBe(5)
    expect(payload.orderNumber).toBe(42)
    expect(payload.waiterId).toBe('waiter-1')
  })

  it('el otro mesero NO recibe order:item:ready', async () => {
    vi.mocked(orderItemsRepository.markItemReady).mockResolvedValue(mockReadyItem as any)

    let receivedByOther = false
    otherWaiterClient.on('order:item:ready', () => { receivedByOther = true })

    const readyPromise = waitForEvent(waiterClient, 'order:item:ready')
    chefClient.emit('item:ready', { itemId: 'item-1' })
    await readyPromise

    await new Promise((r) => setTimeout(r, 150))
    expect(receivedByOther).toBe(false)
  })

  it('emite error al socket si markItemReady falla', async () => {
    vi.mocked(orderItemsRepository.markItemReady).mockRejectedValue(new Error('DB error'))

    const errorPromise = waitForEvent<{ event: string }>(chefClient, 'error')
    chefClient.emit('item:ready', { itemId: 'nonexistent' })

    const err = await errorPromise
    expect(err.event).toBe('item:ready')
  })
})

// ── Tests: item:served → checkAndAutoDeliver ───────────────────────────────────

describe('item:served → checkAndAutoDeliver', () => {
  let server: TestServer
  let waiterClient: ClientSocket

  beforeEach(async () => {
    vi.clearAllMocks()
    server = await createTestServer()
    waiterClient = connectClient(server.port, 'waiter', 'waiter-1')
    await waitForConnect(waiterClient)
  })

  afterEach(async () => {
    waiterClient.disconnect()
    await server.close()
  })

  it('llama a markItemServed y checkAndAutoDeliver con el orderId correcto', async () => {
    vi.mocked(orderItemsRepository.markItemServed).mockResolvedValue(mockServedItem as any)
    vi.mocked(ordersService.checkAndAutoDeliver).mockResolvedValue(undefined)

    waiterClient.emit('item:served', { itemId: 'item-1' })

    // Wait for async handler to complete
    await new Promise((r) => setTimeout(r, 300))

    expect(orderItemsRepository.markItemServed).toHaveBeenCalledWith('item-1')
    expect(ordersService.checkAndAutoDeliver).toHaveBeenCalledWith('order-1')
  })

  it('emite error al socket si markItemServed falla', async () => {
    vi.mocked(orderItemsRepository.markItemServed).mockRejectedValue(new Error('DB error'))

    const errorPromise = waitForEvent<{ event: string }>(waiterClient, 'error')
    waiterClient.emit('item:served', { itemId: 'nonexistent' })

    const err = await errorPromise
    expect(err.event).toBe('item:served')
  })
})

// ── Tests: Flujo completo (integración) ───────────────────────────────────────

describe('Flujo completo — cocinero reclama, termina, mesero recoge', () => {
  let server: TestServer
  let chefClient: ClientSocket
  let waiterClient: ClientSocket
  let kitchenObserver: ClientSocket

  beforeEach(async () => {
    vi.clearAllMocks()
    server = await createTestServer()
    chefClient = connectClient(server.port, 'chef', 'chef-1')
    waiterClient = connectClient(server.port, 'waiter', 'waiter-1')
    kitchenObserver = connectClient(server.port, 'chef', 'chef-2')
    await Promise.all([
      waitForConnect(chefClient),
      waitForConnect(waiterClient),
      waitForConnect(kitchenObserver),
    ])
  })

  afterEach(async () => {
    chefClient.disconnect()
    waiterClient.disconnect()
    kitchenObserver.disconnect()
    await server.close()
  })

  it('ciclo completo: claim → ready → served dispara los tres eventos en orden', async () => {
    vi.mocked(orderItemsRepository.claimItem).mockResolvedValue(mockClaimedItem as any)
    vi.mocked(orderItemsRepository.markItemReady).mockResolvedValue(mockReadyItem as any)
    vi.mocked(orderItemsRepository.markItemServed).mockResolvedValue(mockServedItem as any)
    vi.mocked(ordersService.checkAndAutoDeliver).mockResolvedValue(undefined)

    // Step 1: chef claims the item
    const claimedPromise = waitForEvent(kitchenObserver, 'order:item:claimed')
    chefClient.emit('item:claim', { itemId: 'item-1' })
    await claimedPromise

    // Step 2: chef marks item ready → waiter gets notified
    const readyPromise = waitForEvent(waiterClient, 'order:item:ready')
    chefClient.emit('item:ready', { itemId: 'item-1' })
    await readyPromise

    // Step 3: waiter confirms delivery
    waiterClient.emit('item:served', { itemId: 'item-1' })
    await new Promise((r) => setTimeout(r, 300))

    expect(orderItemsRepository.claimItem).toHaveBeenCalledOnce()
    expect(orderItemsRepository.markItemReady).toHaveBeenCalledOnce()
    expect(orderItemsRepository.markItemServed).toHaveBeenCalledOnce()
    expect(ordersService.checkAndAutoDeliver).toHaveBeenCalledWith('order-1')
  })
})
