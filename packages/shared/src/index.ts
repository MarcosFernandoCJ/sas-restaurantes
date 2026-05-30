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
  WAITERS: 'room:waiters',               // broadcast to all connected waiters
  waiter: (userId: string) => `room:waiter:${userId}`,
} as const

export const WS_EVENTS = {
  // server → kitchen
  ORDER_CREATED: 'order:created',           // new order entered kitchen queue
  ORDER_ADDITIONAL: 'order:additional',     // additional order for existing table
  ORDER_ITEM_CLAIMED: 'order:item:claimed', // chef claimed an item (multi-chef visibility)
  ORDER_ITEM_UPDATED: 'order:item:updated', // waiter edited item notes while in prep
  ORDER_ITEM_READY_KITCHEN: 'order:item:ready', // item ready — emitted to both kitchen AND waiter
  ORDER_DELIVERED: 'order:delivered',       // all items served; kitchen removes the card
  // server → waiter
  ORDER_ITEM_READY: 'order:item:ready',     // dine_in: per-item pickup notification
  ORDER_READY: 'order:ready',               // delivery: all items ready, pack now
  STOCK_ALERT: 'stock:alert',               // ingredient below threshold
  // server → all (journey state — kitchen + waiters + admin)
  JOURNEY_STARTED: 'journey:started',       // admin opened the day; enables order creation
  JOURNEY_ENDED: 'journey:ended',           // admin closed the day; blocks order creation
  // client → server
  ITEM_CLAIM: 'item:claim',                 // optional explicit claim (multi-chef)
  ITEM_READY: 'item:ready',                 // chef marks item done; auto-claims if pending
  ITEM_SERVED: 'item:served',               // waiter confirms delivery
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
