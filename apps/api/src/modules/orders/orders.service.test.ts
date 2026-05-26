import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./orders.repository', () => ({
  ordersRepository: {
    findMenuItemById: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    findById: vi.fn(),
    updateStatus: vi.fn(),
    addItems: vi.fn(),
    getAllItemStatuses: vi.fn(),
  },
}))

import { ordersService } from './orders.service'
import { ordersRepository } from './orders.repository'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockMenuItem = { id: 'menu-1', basePrice: 25, isAvailable: true, name: 'Pollo a la brasa' }

const mockOrder = {
  id: 'order-1',
  orderNumber: 1,
  tableId: 'table-1',
  waiterId: 'waiter-1',
  type: 'dine_in',
  status: 'pending',
  isAdditional: false,
  parentOrderId: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [],
  invoice: null,
  table: null,
  waiter: { id: 'waiter-1', name: 'Juan', email: 'waiter@sas.local' },
}

// ── checkAndAutoDeliver ────────────────────────────────────────────────────────

describe('ordersService.checkAndAutoDeliver — regla de auto-delivered', () => {
  beforeEach(() => vi.clearAllMocks())

  it('actualiza a "delivered" cuando TODOS los ítems tienen status "served"', async () => {
    vi.mocked(ordersRepository.getAllItemStatuses).mockResolvedValue([
      { status: 'served' },
      { status: 'served' },
      { status: 'served' },
    ])

    await ordersService.checkAndAutoDeliver('order-1')

    expect(ordersRepository.updateStatus).toHaveBeenCalledOnce()
    expect(ordersRepository.updateStatus).toHaveBeenCalledWith('order-1', 'delivered')
  })

  it('no actualiza si algún ítem está "ready" (no recogido aún)', async () => {
    vi.mocked(ordersRepository.getAllItemStatuses).mockResolvedValue([
      { status: 'served' },
      { status: 'ready' },
    ])

    await ordersService.checkAndAutoDeliver('order-1')

    expect(ordersRepository.updateStatus).not.toHaveBeenCalled()
  })

  it('no actualiza si algún ítem está "pending"', async () => {
    vi.mocked(ordersRepository.getAllItemStatuses).mockResolvedValue([
      { status: 'served' },
      { status: 'pending' },
    ])

    await ordersService.checkAndAutoDeliver('order-1')

    expect(ordersRepository.updateStatus).not.toHaveBeenCalled()
  })

  it('no actualiza si algún ítem está "in_prep"', async () => {
    vi.mocked(ordersRepository.getAllItemStatuses).mockResolvedValue([
      { status: 'in_prep' },
      { status: 'served' },
    ])

    await ordersService.checkAndAutoDeliver('order-1')

    expect(ordersRepository.updateStatus).not.toHaveBeenCalled()
  })

  it('no actualiza si la lista de ítems está vacía (pedido sin ítems)', async () => {
    vi.mocked(ordersRepository.getAllItemStatuses).mockResolvedValue([])

    await ordersService.checkAndAutoDeliver('order-1')

    expect(ordersRepository.updateStatus).not.toHaveBeenCalled()
  })

  it('funciona con un único ítem served', async () => {
    vi.mocked(ordersRepository.getAllItemStatuses).mockResolvedValue([{ status: 'served' }])

    await ordersService.checkAndAutoDeliver('order-1')

    expect(ordersRepository.updateStatus).toHaveBeenCalledWith('order-1', 'delivered')
  })
})

// ── createOrder ───────────────────────────────────────────────────────────────

describe('ordersService.createOrder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('crea un pedido normal con isAdditional=false cuando no hay parentOrderId', async () => {
    vi.mocked(ordersRepository.findMenuItemById).mockResolvedValue(mockMenuItem as any)
    vi.mocked(ordersRepository.create).mockResolvedValue(mockOrder as any)

    await ordersService.createOrder({
      tableId: 'table-1',
      waiterId: 'waiter-1',
      type: 'dine_in',
      items: [{ menuItemId: 'menu-1', quantity: 2 }],
    })

    expect(ordersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ isAdditional: false, parentOrderId: undefined })
    )
  })

  it('crea un pedido adicional con isAdditional=true cuando se pasa parentOrderId', async () => {
    vi.mocked(ordersRepository.findMenuItemById).mockResolvedValue(mockMenuItem as any)
    vi.mocked(ordersRepository.create).mockResolvedValue({
      ...mockOrder,
      isAdditional: true,
      parentOrderId: 'order-parent',
    } as any)

    await ordersService.createOrder({
      tableId: 'table-1',
      waiterId: 'waiter-1',
      type: 'dine_in',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
      parentOrderId: 'order-parent',
    })

    expect(ordersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ isAdditional: true, parentOrderId: 'order-parent' })
    )
  })

  it('usa el precio del DB (basePrice), no confía en el cliente', async () => {
    vi.mocked(ordersRepository.findMenuItemById).mockResolvedValue({
      ...mockMenuItem,
      basePrice: 42.5,
    } as any)
    vi.mocked(ordersRepository.create).mockResolvedValue(mockOrder as any)

    await ordersService.createOrder({
      waiterId: 'waiter-1',
      type: 'dine_in',
      items: [{ menuItemId: 'menu-1', quantity: 1 }],
    })

    expect(ordersRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ unitPrice: 42.5 }),
        ]),
      })
    )
  })

  it('lanza 404 si un menuItemId no existe en la BD', async () => {
    vi.mocked(ordersRepository.findMenuItemById).mockResolvedValue(null)

    await expect(
      ordersService.createOrder({
        waiterId: 'waiter-1',
        type: 'dine_in',
        items: [{ menuItemId: 'nonexistent-id', quantity: 1 }],
      })
    ).rejects.toMatchObject({ statusCode: 404 })

    expect(ordersRepository.create).not.toHaveBeenCalled()
  })
})

// ── getOrderById ──────────────────────────────────────────────────────────────

describe('ordersService.getOrderById', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna el pedido si existe', async () => {
    vi.mocked(ordersRepository.findById).mockResolvedValue(mockOrder as any)

    const order = await ordersService.getOrderById('order-1')

    expect(order.id).toBe('order-1')
  })

  it('lanza 404 si el pedido no existe', async () => {
    vi.mocked(ordersRepository.findById).mockResolvedValue(null)

    await expect(ordersService.getOrderById('nonexistent')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Pedido no encontrado',
    })
  })
})

// ── updateOrderStatus ─────────────────────────────────────────────────────────

describe('ordersService.updateOrderStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('actualiza el estado del pedido', async () => {
    vi.mocked(ordersRepository.findById).mockResolvedValue(mockOrder as any)
    vi.mocked(ordersRepository.updateStatus).mockResolvedValue({
      ...mockOrder,
      status: 'in_prep',
    } as any)

    const updated = await ordersService.updateOrderStatus('order-1', { status: 'in_prep' })

    expect(ordersRepository.updateStatus).toHaveBeenCalledWith('order-1', 'in_prep')
    expect(updated.status).toBe('in_prep')
  })

  it('lanza 404 si el pedido no existe', async () => {
    vi.mocked(ordersRepository.findById).mockResolvedValue(null)

    await expect(
      ordersService.updateOrderStatus('nonexistent', { status: 'in_prep' })
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

// ── listOrders ────────────────────────────────────────────────────────────────

describe('ordersService.listOrders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna lista paginada con metadata', async () => {
    vi.mocked(ordersRepository.findMany).mockResolvedValue({
      orders: [mockOrder, mockOrder] as any,
      total: 2,
    })

    const result = await ordersService.listOrders({ page: 1, limit: 10 })

    expect(result.data).toHaveLength(2)
    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 2, pages: 1 })
    expect(ordersRepository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 })
    )
  })

  it('calcula skip correctamente para página 2', async () => {
    vi.mocked(ordersRepository.findMany).mockResolvedValue({ orders: [], total: 25 })

    await ordersService.listOrders({ page: 2, limit: 10 })

    expect(ordersRepository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    )
  })
})
