export type IngredientStatus = 'ok' | 'low' | 'critical' | 'out'
export type CategoryType = 'food' | 'drink' | 'other'
export type AdminTab = 'inicio' | 'insumos' | 'recetario' | 'reportes' | 'ventas' | 'compras' | 'configuracion'

export interface AdminUser {
  id: string
  name: string
  email: string
  role: 'admin'
}

export interface RecipeIngredient {
  id: string
  name: string
  unit: string
  stockQty: number
  minStockQty: number
  unitCost: number
  status: IngredientStatus
}

export interface RecipeEntry {
  id: string
  quantityNeeded: number
  notes: string | null
  ingredient: RecipeIngredient
}

export interface DailyMenuItem {
  id: string
  menuItemId: string
  overridePrice: number | null
  confirmedAt: string | null
  menuItem: {
    id: string
    name: string
    description: string | null
    basePrice: number
    prepTimeMinutes: number
    isAvailable: boolean
    isFeatured: boolean
    category: {
      id: string
      name: string
      type: CategoryType
    }
    recipes: RecipeEntry[]
  }
}

export interface KpiToday {
  salesToday: number
  salesYesterday: number
  ordersToday: number
  itemsServedToday: number
}

export interface CriticalIngredient {
  id: string
  name: string
  unit: string
  stockQty: number
  neededToday: number
  toBuy: number
  unitCost: number
  status: IngredientStatus
}

export interface StockAlertPayload {
  ingredientId: string
  ingredientName: string
  status: 'low' | 'critical' | 'out'
  stockQty: number
  minStockQty: number
}

// ─── Insumos ──────────────────────────────────────────────────────────────────

export interface Ingredient {
  id: string
  name: string
  unit: string
  stockQty: number
  minStockQty: number
  unitCost: number
  supplierId: string | null
  status: IngredientStatus
  isActive: boolean
  updatedAt: string
}

// ─── Recetario ────────────────────────────────────────────────────────────────

export interface MenuCategory {
  id: string
  name: string
  type: CategoryType
  sortOrder: number
}

export interface RecipeLine {
  id: string
  ingredientId: string
  quantityNeeded: number
  notes: string | null
  ingredient: {
    id: string
    name: string
    unit: string
    unitCost: number
  }
}

export interface MenuItem {
  id: string
  categoryId: string
  name: string
  description: string | null
  basePrice: number
  prepTimeMinutes: number
  imageUrl: string | null
  isAvailable: boolean
  isFeatured: boolean
  isDirectIngredient: boolean
  category: MenuCategory
  recipes: RecipeLine[]
}

export type RecetarioFilter = 'all' | 'food' | 'drink'

// ─── Reportes ─────────────────────────────────────────────────────────────────

export type ReportPeriod = 'today' | 'week' | 'month' | 'year'

export interface ReportKpi {
  ingresos: number
  costos: number
  ganancias: number
  margen: number
  ordersCount: number
}

export interface PaymentMethodStat {
  method: string
  total: number
  count: number
}

export interface TopDish {
  menuItemId: string
  name: string
  quantitySold: number
  totalRevenue: number
}

export interface HourlyEntry {
  hour: number
  label: string
  orders: number
  revenue: number
}

export interface ReportData {
  kpi: ReportKpi
  paymentMethods: PaymentMethodStat[]
  topDishes: TopDish[]
  hourlyBreakdown: HourlyEntry[]
  operational: {
    avgPrepSecs: number
    avgPrepMin: number
  }
}

// ─── Ventas ───────────────────────────────────────────────────────────────────

export interface SaleRecord {
  id: string
  orderNumber: number
  table: { id: string; number: number; section: string | null } | null
  waiter: { id: string; name: string }
  type: 'dine_in' | 'delivery'
  status: string
  isAdditional: boolean
  createdAt: string
  itemCount: number
  invoice: {
    id: string
    invoiceNumber: string
    status: 'pending' | 'paid' | 'voided'
    paymentMethod: string
    total: number
    paidAt: string | null
  } | null
}

export interface SalesPage {
  data: SaleRecord[]
  total: number
  page: number
  limit: number
}

// ─── Configuración ────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'waiter' | 'chef'

export interface SystemUser {
  id: string
  name: string
  email: string
  role: UserRole
  isActive: boolean
  mustChangePassword: boolean
}

export interface RestaurantTable {
  id: string
  number: number
  capacity: number
  section: string
}

export type TableMode = 'free' | 'assigned'

export interface SystemParams {
  reminderIntervalMin: number
  criticalTimerMin: number
  tableMode: TableMode
}

export interface TableForAssignment {
  id: string
  number: number
  section: string | null
}

export interface WaiterTableAssignment {
  sessionId: string
  waiterId: string
  waiterName: string
  tables: TableForAssignment[]
}

// ─── Compras ──────────────────────────────────────────────────────────────────

export interface Supplier {
  id: string
  name: string
  contactName: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
}

export interface PurchaseItemDetail {
  id: string
  ingredientId: string
  quantity: number
  unitCost: number
  subtotal: number
  ingredient: {
    id: string
    name: string
    unit: string
  }
}

export interface Purchase {
  id: string
  supplierId: string | null
  purchasedAt: string
  totalCost: number
  supplier: Supplier | null
  items: PurchaseItemDetail[]
}
