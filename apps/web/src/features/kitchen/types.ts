export type OrderType = 'dine_in' | 'delivery'
export type ItemStatus = 'pending' | 'in_prep' | 'ready' | 'served'

export interface KitchenOrderItem {
  id: string
  menuItemName: string
  quantity: number
  notes?: string
  status: ItemStatus
  assignedChefName?: string
  hasUpdate: boolean
}

export interface KitchenOrder {
  id: string
  orderNumber: number
  type: OrderType
  tableNumber?: number
  isAdditional: boolean
  parentOrderId?: string
  notes?: string
  createdAt: Date
  items: KitchenOrderItem[]
}

// Socket event payload shapes (server → client)
export interface OrderCreatedPayload {
  id: string
  orderNumber: number
  type: OrderType
  tableNumber?: number
  isAdditional: boolean
  parentOrderId?: string
  notes?: string
  createdAt: string
  items: Array<{
    id: string
    menuItemName: string
    quantity: number
    notes?: string
    status: ItemStatus
  }>
}

export interface OrderItemClaimedPayload {
  orderId: string
  itemId: string
  chefName: string
}

export interface OrderItemUpdatedPayload {
  orderId: string
  itemId: string
  notes?: string
  quantity?: number
  menuItemName?: string
}