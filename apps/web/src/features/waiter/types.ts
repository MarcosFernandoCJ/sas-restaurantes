export type PaymentMethod = 'cash' | 'card' | 'yape' | 'plin' | 'other'
export type OrderType = 'dine_in' | 'delivery'
export type TableStatus = 'free' | 'occupied' | 'reserved'
export type ItemStatus = 'pending' | 'in_prep' | 'ready' | 'served'
export type OrderStatus = 'pending' | 'in_prep' | 'ready' | 'delivered' | 'cancelled'

export interface WaiterUser {
  id: string
  name: string
  email: string
  role: string
}

export interface ApiMenuItem {
  id: string
  name: string
  description: string | null
  basePrice: string
  prepTimeMinutes: number
  imageUrl: string | null
  isAvailable: boolean
  isFeatured: boolean
  category: { id: string; name: string; type: 'food' | 'drink' | 'other' }
}

export interface ActiveOrderSummary {
  id: string
  orderNumber: number
  status: OrderStatus
  isAdditional: boolean
  createdAt: string
  items: Array<{
    id: string
    status: ItemStatus
    menuItem: { name: string }
  }>
}

export interface ApiTable {
  id: string
  number: number
  capacity: number
  status: TableStatus
  section: string | null
  orders: ActiveOrderSummary[]
}

export interface CartItem {
  menuItemId: string
  name: string
  basePrice: number
  quantity: number
  notes: string
}

export interface ApiOrder {
  id: string
  orderNumber: number
  type: OrderType
  status: OrderStatus
  isAdditional: boolean
  parentOrderId: string | null
  notes: string | null
  createdAt: string
  table: { id: string; number: number; section: string | null } | null
  waiter: { id: string; name: string }
  items: Array<{
    id: string
    quantity: number
    unitPrice: string
    notes: string | null
    status: ItemStatus
    menuItem: { id: string; name: string; prepTimeMinutes: number }
  }>
  invoice: {
    id: string
    invoiceNumber: string
    subtotal: string
    tax: string
    total: string
    status: 'pending' | 'paid' | 'voided'
    paymentMethod: PaymentMethod
    paidAt: string | null
  } | null
}

export interface ApiInvoice {
  id: string
  orderId: string
  invoiceNumber: string
  subtotal: string
  tax: string
  total: string
  status: 'pending' | 'paid' | 'voided'
  paymentMethod: PaymentMethod
  paidAt: string | null
}

// Notification from order:item:ready socket event
export interface ItemReadyNotification {
  itemId: string
  orderId: string
  menuItemName: string
  tableId: string | null
  tableNumber: number | null
  orderNumber: number
  waiterId: string
  receivedAt: Date
  isReminder?: boolean
}