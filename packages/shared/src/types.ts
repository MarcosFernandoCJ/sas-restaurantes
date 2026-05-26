// =============================================================================
// DTOs y tipos del dominio compartidos entre apps/api y apps/web
// Espejo de los modelos Prisma como interfaces TypeScript puras
// (no depende de @prisma/client para que el frontend no lo importe)
// =============================================================================

import type { UserRole, OrderStatus, ItemStatus, InvoiceStatus, PaymentMethod, OrderType, TableStatus, IngredientStatus, CategoryType } from './index'

// --- Usuarios ---
export interface UserDto {
  id: string
  name: string
  email: string
  role: UserRole
  isActive: boolean
  createdAt: string
}

// --- Mesas ---
export interface TableDto {
  id: string
  number: number
  capacity: number
  status: TableStatus
  section: string | null
}

// --- Categorías ---
export interface MenuCategoryDto {
  id: string
  name: string
  type: CategoryType
  sortOrder: number
  isActive: boolean
}

// --- Platos / Bebidas ---
export interface MenuItemDto {
  id: string
  categoryId: string
  name: string
  description: string | null
  basePrice: string // Decimal serializado como string
  prepTimeMinutes: number
  imageUrl: string | null
  isAvailable: boolean
  isFeatured: boolean
  category?: MenuCategoryDto
}

// --- Ingredientes ---
export interface IngredientDto {
  id: string
  name: string
  unit: string
  stockQty: string
  minStockQty: string
  unitCost: string
  supplierId: string | null
  status: IngredientStatus
  isActive: boolean
}

// --- Pedidos ---
export interface OrderDto {
  id: string
  orderNumber: number
  tableId: string | null
  waiterId: string
  type: OrderType
  status: OrderStatus
  notes: string | null
  isAdditional: boolean
  parentOrderId: string | null
  createdAt: string
  updatedAt: string
  items?: OrderItemDto[]
  invoice?: InvoiceDto | null
}

export interface OrderItemDto {
  id: string
  orderId: string
  menuItemId: string
  quantity: number
  unitPrice: string
  notes: string | null
  status: ItemStatus
  assignedChefId: string | null
  prepStartedAt: string | null
  prepFinishedAt: string | null
  menuItem?: MenuItemDto
}

// --- Facturas ---
export interface InvoiceDto {
  id: string
  orderId: string
  invoiceNumber: string
  subtotal: string
  tax: string
  total: string
  status: InvoiceStatus
  paymentMethod: PaymentMethod
  paidAt: string | null
  paymentReference: string | null
  createdAt: string
}

// --- Proveedores ---
export interface SupplierDto {
  id: string
  name: string
  contactName: string | null
  phone: string | null
  email: string | null
}

// --- Recetas ---
export interface RecipeDto {
  id: string
  menuItemId: string
  ingredientId: string
  quantityNeeded: string
  notes: string | null
}

// --- Payload de eventos WebSocket ---
export interface WsOrderCreatedPayload {
  order: OrderDto
}

export interface WsItemClaimedPayload {
  itemId: string
  orderId: string
  chefId: string
  chefName: string
}

export interface WsItemReadyPayload {
  itemId: string
  orderId: string
  orderNumber: number
  tableId: string | null
  waiterId: string
}

export interface WsStockAlertPayload {
  ingredientId: string
  ingredientName: string
  status: IngredientStatus
  stockQty: number
  minStockQty: number
}
