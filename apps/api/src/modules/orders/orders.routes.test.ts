import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import jwt from 'jsonwebtoken'
import { ordersRoutes } from './orders.routes'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('./orders.service', () => ({
  ordersService: {
    createOrder: vi.fn(),
    listOrders: vi.fn(),
    getOrderById: vi.fn(),
    updateOrderStatus: vi.fn(),
    addItemsToOrder: vi.fn(),
    checkAndAutoDeliver: vi.fn(),
  },
}))

// El nuevo endpoint PATCH /orders/:orderId/items/:itemId llama directamente al repository
vi.mock('./order-items.repository', () => ({
  orderItemsRepository: {
    findById: vi.fn(),
    updateNotes: vi.fn(),
  },
}))

// lib/socket usa ioredis y socket.io — evitar inicialización en tests de rutas
vi.mock('../../lib/socket', () => ({
  emitToRoom: vi.fn(),
}))

import { ordersService } from './orders.service'

// ── Helpers ────────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret'

// UUIDs fijos para los tests (RFC 4122 válidos — Zod v4 verifica bits de versión y variante)
const MENU_ITEM_ID_1 = '550e8400-e29b-41d4-a716-446655440000'
const MENU_ITEM_ID_2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const TABLE_ID = 'a3bb189e-8bf9-3888-9912-ace4e6543002'
const PARENT_ORDER_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
const WAITER_UUID = 'e4d909c2-906d-4ad9-b9b9-a6e6c7b3c9d0'

function makeToken(role: 'admin' | 'waiter' | 'chef', userId = 'user-1') {
  return jwt.sign(
    { sub: userId, email: `${role}@sas.local`, role, type: 'access' },
    JWT_SECRET,
    { expiresIn: '15m' }
  )
}

async function buildApp() {
  const app = Fastify({ logger: false })
  await app.register(ordersRoutes)
  return app
}

// ── Fixture base de pedido ─────────────────────────────────────────────────────

const mockOrder = {
  id: 'order-1',
  orderNumber: 1,
  tableId: 'table-1',
  waiterId: 'user-1',
  type: 'dine_in',
  status: 'pending',
  notes: null,
  isAdditional: false,
  parentOrderId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  items: [
    {
      id: 'item-1',
      orderId: 'order-1',
      menuItemId: MENU_ITEM_ID_1,
      quantity: 2,
      unitPrice: '25.00',
      notes: null,
      status: 'pending',
      assignedChefId: null,
      prepStartedAt: null,
      prepFinishedAt: null,
      menuItem: { id: MENU_ITEM_ID_1, name: 'Pollo a la brasa', prepTimeMinutes: 20 },
    },
  ],
  invoice: null,
  table: { id: 'table-1', number: 5, section: 'Salón' },
  waiter: { id: 'user-1', name: 'Juan', email: 'waiter@sas.local' },
}

// ── POST /orders ───────────────────────────────────────────────────────────────

describe('POST /orders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna 201 con el pedido creado (happy path)', async () => {
    vi.mocked(ordersService.createOrder).mockResolvedValue(mockOrder as any)

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: { Authorization: `Bearer ${makeToken('waiter')}` },
      payload: {
        tableId: TABLE_ID,
        type: 'dine_in',
        items: [{ menuItemId: MENU_ITEM_ID_1, quantity: 2 }],
      },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.status).toBe('pending')
    expect(body.isAdditional).toBe(false)
    expect(ordersService.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        waiterId: 'user-1',
        tableId: TABLE_ID,
        type: 'dine_in',
      })
    )
  })

  it('inyecta waiterId desde el JWT — no del body', async () => {
    vi.mocked(ordersService.createOrder).mockResolvedValue(mockOrder as any)

    const app = await buildApp()
    await app.inject({
      method: 'POST',
      url: '/orders',
      headers: { Authorization: `Bearer ${makeToken('waiter', WAITER_UUID)}` },
      payload: { items: [{ menuItemId: MENU_ITEM_ID_1, quantity: 1 }] },
    })

    expect(ordersService.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ waiterId: WAITER_UUID })
    )
  })

  it('crea un pedido adicional cuando se envía parentOrderId', async () => {
    const additionalOrder = { ...mockOrder, isAdditional: true, parentOrderId: PARENT_ORDER_ID }
    vi.mocked(ordersService.createOrder).mockResolvedValue(additionalOrder as any)

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: { Authorization: `Bearer ${makeToken('waiter')}` },
      payload: {
        tableId: TABLE_ID,
        type: 'dine_in',
        items: [{ menuItemId: MENU_ITEM_ID_1, quantity: 1 }],
        parentOrderId: PARENT_ORDER_ID,
      },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().isAdditional).toBe(true)
    expect(ordersService.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ parentOrderId: PARENT_ORDER_ID })
    )
  })

  it('el admin también puede crear pedidos', async () => {
    vi.mocked(ordersService.createOrder).mockResolvedValue(mockOrder as any)

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: { Authorization: `Bearer ${makeToken('admin')}` },
      payload: { items: [{ menuItemId: MENU_ITEM_ID_1, quantity: 1 }] },
    })

    expect(res.statusCode).toBe(201)
  })

  it('retorna 400 si items está vacío', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: { Authorization: `Bearer ${makeToken('waiter')}` },
      payload: { tableId: 'table-1', items: [] },
    })

    expect(res.statusCode).toBe(400)
    expect(ordersService.createOrder).not.toHaveBeenCalled()
  })

  it('retorna 400 si falta el campo items', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: { Authorization: `Bearer ${makeToken('waiter')}` },
      payload: { tableId: 'table-1' },
    })

    expect(res.statusCode).toBe(400)
    expect(ordersService.createOrder).not.toHaveBeenCalled()
  })

  it('retorna 401 sin header Authorization', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/orders',
      payload: { items: [{ menuItemId: 'menu-item-1', quantity: 1 }] },
    })

    expect(res.statusCode).toBe(401)
  })

  it('retorna 403 si un chef intenta crear un pedido', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: { Authorization: `Bearer ${makeToken('chef')}` },
      payload: { items: [{ menuItemId: 'menu-item-1', quantity: 1 }] },
    })

    expect(res.statusCode).toBe(403)
  })

  it('retorna 404 si un menuItem no existe (error del servicio)', async () => {
    const nonExistentId = 'c9d9f6a0-3b1e-4f8c-a234-b56789012345'
    vi.mocked(ordersService.createOrder).mockRejectedValue(
      Object.assign(new Error(`Ítem de menú no encontrado: ${nonExistentId}`), { statusCode: 404 })
    )

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: { Authorization: `Bearer ${makeToken('waiter')}` },
      payload: { items: [{ menuItemId: nonExistentId, quantity: 1 }] },
    })

    expect(res.statusCode).toBe(404)
  })
})

// ── GET /orders ────────────────────────────────────────────────────────────────

describe('GET /orders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna 200 con lista paginada (happy path)', async () => {
    vi.mocked(ordersService.listOrders).mockResolvedValue({
      data: [mockOrder],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    } as any)

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/orders',
      headers: { Authorization: `Bearer ${makeToken('waiter')}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveLength(1)
    expect(body.pagination.total).toBe(1)
  })

  it('pasa los filtros de query al servicio', async () => {
    vi.mocked(ordersService.listOrders).mockResolvedValue({
      data: [],
      pagination: { page: 2, limit: 5, total: 0, pages: 0 },
    } as any)

    const app = await buildApp()
    await app.inject({
      method: 'GET',
      url: '/orders?status=in_prep&type=dine_in&page=2&limit=5',
      headers: { Authorization: `Bearer ${makeToken('admin')}` },
    })

    expect(ordersService.listOrders).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'in_prep', type: 'dine_in', page: 2, limit: 5 })
    )
  })

  it('el chef puede listar pedidos', async () => {
    vi.mocked(ordersService.listOrders).mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, pages: 0 },
    } as any)

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/orders',
      headers: { Authorization: `Bearer ${makeToken('chef')}` },
    })

    expect(res.statusCode).toBe(200)
  })

  it('retorna 401 sin token', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/orders' })
    expect(res.statusCode).toBe(401)
  })
})

// ── GET /orders/:id ────────────────────────────────────────────────────────────

describe('GET /orders/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna 200 con el detalle del pedido (happy path)', async () => {
    vi.mocked(ordersService.getOrderById).mockResolvedValue(mockOrder as any)

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/orders/order-1',
      headers: { Authorization: `Bearer ${makeToken('waiter')}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBe('order-1')
    expect(body.items).toHaveLength(1)
    expect(body.items[0].menuItem.name).toBe('Pollo a la brasa')
  })

  it('retorna 404 si el pedido no existe', async () => {
    vi.mocked(ordersService.getOrderById).mockRejectedValue(
      Object.assign(new Error('Pedido no encontrado'), { statusCode: 404 })
    )

    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/orders/nonexistent-id',
      headers: { Authorization: `Bearer ${makeToken('waiter')}` },
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().error).toBe('Pedido no encontrado')
  })

  it('retorna 401 sin token', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/orders/order-1' })
    expect(res.statusCode).toBe(401)
  })
})

// ── PATCH /orders/:id/status ───────────────────────────────────────────────────

describe('PATCH /orders/:id/status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('actualiza el estado del pedido (happy path)', async () => {
    const updatedOrder = { ...mockOrder, status: 'in_prep' }
    vi.mocked(ordersService.updateOrderStatus).mockResolvedValue(updatedOrder as any)

    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/status',
      headers: { Authorization: `Bearer ${makeToken('waiter')}` },
      payload: { status: 'in_prep' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('in_prep')
    expect(ordersService.updateOrderStatus).toHaveBeenCalledWith('order-1', { status: 'in_prep' })
  })

  it('el chef puede cambiar el estado', async () => {
    const updatedOrder = { ...mockOrder, status: 'ready' }
    vi.mocked(ordersService.updateOrderStatus).mockResolvedValue(updatedOrder as any)

    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/status',
      headers: { Authorization: `Bearer ${makeToken('chef')}` },
      payload: { status: 'ready' },
    })

    expect(res.statusCode).toBe(200)
  })

  it('retorna 400 si el status es inválido', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/status',
      headers: { Authorization: `Bearer ${makeToken('waiter')}` },
      payload: { status: 'invalid_value' },
    })

    expect(res.statusCode).toBe(400)
    expect(ordersService.updateOrderStatus).not.toHaveBeenCalled()
  })

  it('retorna 404 si el pedido no existe', async () => {
    vi.mocked(ordersService.updateOrderStatus).mockRejectedValue(
      Object.assign(new Error('Pedido no encontrado'), { statusCode: 404 })
    )

    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/nonexistent/status',
      headers: { Authorization: `Bearer ${makeToken('waiter')}` },
      payload: { status: 'in_prep' },
    })

    expect(res.statusCode).toBe(404)
  })

  it('puede cambiar el estado a "delivered" (regla auto-delivered integration)', async () => {
    const deliveredOrder = { ...mockOrder, status: 'delivered' }
    vi.mocked(ordersService.updateOrderStatus).mockResolvedValue(deliveredOrder as any)

    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/orders/order-1/status',
      headers: { Authorization: `Bearer ${makeToken('waiter')}` },
      payload: { status: 'delivered' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('delivered')
  })
})

// ── POST /orders/:id/items ─────────────────────────────────────────────────────

describe('POST /orders/:id/items', () => {
  beforeEach(() => vi.clearAllMocks())

  it('agrega ítems al pedido y retorna el pedido actualizado (happy path)', async () => {
    const newItem = {
      id: 'item-2',
      orderId: 'order-1',
      menuItemId: MENU_ITEM_ID_2,
      quantity: 1,
      unitPrice: '15.00',
      notes: 'sin azúcar',
      status: 'pending',
      assignedChefId: null,
      prepStartedAt: null,
      prepFinishedAt: null,
      menuItem: { id: MENU_ITEM_ID_2, name: 'Gaseosa', prepTimeMinutes: 2 },
    }
    const updatedOrder = { ...mockOrder, items: [...mockOrder.items, newItem] }
    vi.mocked(ordersService.addItemsToOrder).mockResolvedValue(updatedOrder as any)

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/orders/order-1/items',
      headers: { Authorization: `Bearer ${makeToken('waiter')}` },
      payload: {
        items: [{ menuItemId: MENU_ITEM_ID_2, quantity: 1, notes: 'sin azúcar' }],
      },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().items).toHaveLength(2)
    expect(ordersService.addItemsToOrder).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({ items: expect.arrayContaining([expect.objectContaining({ menuItemId: MENU_ITEM_ID_2 })]) })
    )
  })

  it('retorna 400 si items está vacío', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/orders/order-1/items',
      headers: { Authorization: `Bearer ${makeToken('waiter')}` },
      payload: { items: [] },
    })

    expect(res.statusCode).toBe(400)
    expect(ordersService.addItemsToOrder).not.toHaveBeenCalled()
  })

  it('retorna 401 sin token', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/orders/order-1/items',
      payload: { items: [{ menuItemId: 'menu-item-1', quantity: 1 }] },
    })

    expect(res.statusCode).toBe(401)
  })

  it('retorna 403 si un chef intenta agregar ítems', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/orders/order-1/items',
      headers: { Authorization: `Bearer ${makeToken('chef')}` },
      payload: { items: [{ menuItemId: 'menu-item-1', quantity: 1 }] },
    })

    expect(res.statusCode).toBe(403)
  })

  it('retorna 404 si el pedido no existe', async () => {
    vi.mocked(ordersService.addItemsToOrder).mockRejectedValue(
      Object.assign(new Error('Pedido no encontrado'), { statusCode: 404 })
    )

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/orders/nonexistent/items',
      headers: { Authorization: `Bearer ${makeToken('waiter')}` },
      payload: { items: [{ menuItemId: MENU_ITEM_ID_1, quantity: 1 }] },
    })

    expect(res.statusCode).toBe(404)
  })
})
