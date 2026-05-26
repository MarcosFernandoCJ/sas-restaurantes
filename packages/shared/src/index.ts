// =============================================================================
// @sas/shared — Tipos, enums, constantes y DTOs compartidos
// =============================================================================

// --- Enums (deben coincidir exactamente con los enums de Prisma en BD) ---

export enum UserRole {
  admin = 'admin',
  waiter = 'waiter',
  chef = 'chef',
}

export enum TableStatus {
  free = 'free',
  occupied = 'occupied',
  reserved = 'reserved',
}

export enum WaiterMode {
  free = 'free',
  assigned = 'assigned',
}

export enum OrderType {
  dine_in = 'dine_in',
  delivery = 'delivery',
}

export enum OrderStatus {
  pending = 'pending',
  in_prep = 'in_prep',
  ready = 'ready',
  delivered = 'delivered',
  cancelled = 'cancelled',
}

export enum ItemStatus {
  pending = 'pending',
  in_prep = 'in_prep',
  ready = 'ready',
  served = 'served',
}

export enum InvoiceStatus {
  pending = 'pending',
  paid = 'paid',
  voided = 'voided',
}

export enum PaymentMethod {
  cash = 'cash',
  card = 'card',
  yape = 'yape',
  plin = 'plin',
  other = 'other',
}

export enum IngredientStatus {
  ok = 'ok',
  low = 'low',
  critical = 'critical',
  out = 'out',
}

export enum CategoryType {
  food = 'food',
  drink = 'drink',
  other = 'other',
}

// --- Constantes de WebSocket ---

export const WS_ROOMS = {
  KITCHEN: 'room:kitchen',
  ADMIN: 'room:admin',
  waiter: (userId: string) => `room:waiter:${userId}`,
} as const

export const WS_EVENTS = {
  // server → client
  ORDER_CREATED: 'order:created',
  ORDER_ITEM_CLAIMED: 'order:item:claimed',
  ORDER_ITEM_READY: 'order:item:ready',
  ORDER_ITEM_UPDATED: 'order:item:updated',
  ORDER_ADDITIONAL: 'order:additional',
  STOCK_ALERT: 'stock:alert',
  // client → server
  ITEM_CLAIM: 'item:claim',
  ITEM_READY: 'item:ready',
  ITEM_SERVED: 'item:served',
} as const

// --- DTOs y tipos del dominio ---
export type {
  UserDto,
  TableDto,
  MenuCategoryDto,
  MenuItemDto,
  IngredientDto,
  OrderDto,
  OrderItemDto,
  InvoiceDto,
  SupplierDto,
  RecipeDto,
  WsOrderCreatedPayload,
  WsItemClaimedPayload,
  WsItemReadyPayload,
  WsStockAlertPayload,
} from './types'
