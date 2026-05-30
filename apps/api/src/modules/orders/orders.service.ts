import { ordersRepository } from './orders.repository'
import type { CreateOrderBody, UpdateOrderStatusBody, AddOrderItemsBody, ListOrdersQuery } from './orders.schema'

function makeError(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode })
}

export const ordersService = {
  async createOrder(data: CreateOrderBody & { waiterId: string }) {
    // Fetch current price and dispatch area from DB — prevents price manipulation from client
    const itemsWithPrices = await Promise.all(
      data.items.map(async item => {
        const menuItem = await ordersRepository.findMenuItemById(item.menuItemId)
        if (!menuItem) {
          throw makeError(`Ítem de menú no encontrado: ${item.menuItemId}`, 404)
        }
        return {
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          notes: item.notes,
          unitPrice: Number(menuItem.basePrice),
          assignedArea: menuItem.dispatchArea,
        }
      })
    )

    // parentOrderId presence automatically marks the order as additional
    const isAdditional = !!data.parentOrderId

    return ordersRepository.create({
      tableId: data.tableId,
      waiterId: data.waiterId,
      type: data.type,
      notes: data.notes,
      isAdditional,
      parentOrderId: data.parentOrderId,
      items: itemsWithPrices,
    })
  },

  async listOrders(query: ListOrdersQuery) {
    const { page, limit, ...filters } = query
    const skip = (page - 1) * limit

    const { orders, total } = await ordersRepository.findMany({ ...filters, skip, take: limit })

    return {
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  },

  async getOrderById(id: string) {
    const order = await ordersRepository.findById(id)
    if (!order) throw makeError('Pedido no encontrado', 404)
    return order
  },

  async updateOrderStatus(id: string, body: UpdateOrderStatusBody) {
    const order = await ordersRepository.findById(id)
    if (!order) throw makeError('Pedido no encontrado', 404)
    return ordersRepository.updateStatus(id, body.status)
  },

  async addItemsToOrder(orderId: string, body: AddOrderItemsBody) {
    const order = await ordersRepository.findById(orderId)
    if (!order) throw makeError('Pedido no encontrado', 404)

    const itemsWithPrices = await Promise.all(
      body.items.map(async item => {
        const menuItem = await ordersRepository.findMenuItemById(item.menuItemId)
        if (!menuItem) {
          throw makeError(`Ítem de menú no encontrado: ${item.menuItemId}`, 404)
        }
        return {
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          notes: item.notes,
          unitPrice: Number(menuItem.basePrice),
          assignedArea: menuItem.dispatchArea,
        }
      })
    )

    await ordersRepository.addItems(orderId, itemsWithPrices)

    // Re-fetch to return the full updated order
    const updated = await ordersRepository.findById(orderId)
    return updated!
  },

  // Called when an order_item status changes to 'served'.
  // When ALL items in the order are served, the order auto-transitions to 'delivered'.
  // Returns true if the order was just delivered (for caller to trigger journey metrics).
  async checkAndAutoDeliver(orderId: string): Promise<boolean> {
    const items = await ordersRepository.getAllItemStatuses(orderId)
    if (items.length > 0 && items.every((item: { status: string }) => item.status === 'served')) {
      await ordersRepository.updateStatus(orderId, 'delivered')
      return true
    }
    return false
  },
}
