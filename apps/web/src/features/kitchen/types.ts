export type OrderType = 'dine_in' | 'delivery'
export type ItemStatus = 'pending' | 'in_prep' | 'ready' | 'served'

// KitchenOrderItem only contains kitchen-managed (food) items.
// Drinks and waiter-service items are filtered out on the backend.
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

// Kitchen has two display zones based on item states:
//   'active'  — at least one item is pending or in_prep (needs kitchen action)
//   'ready'   — all items done, waiting for waiter pickup
export type KitchenZone = 'active' | 'ready'

// Journey / shift state synced from server
export interface JourneyState {
  sessionId: string | null
  isOpen: boolean
  startedAt: string | null
}

// Socket event payloads (server → client) ─────────────────────────────────────

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
  chefName: string | null
  autoClaimed?: boolean
}

// Emitted to room:kitchen when any item becomes ready (for dimming)
export interface OrderItemReadyKitchenPayload {
  itemId: string
  orderId: string
  orderNumber: number
}

export interface OrderItemUpdatedPayload {
  orderId: string
  itemId: string
  notes?: string
  quantity?: number
  menuItemName?: string
}

export interface OrderDeliveredPayload {
  orderId: string
}

export interface JourneyStartedPayload {
  sessionId: string
  startedAt: string
}

export interface JourneyEndedPayload {
  sessionId: string
  endedAt: string
}
