export { AdminLayout } from './components/AdminLayout'
export { AdminLoginForm } from './components/AdminLoginForm'
export { TodayMenuSection } from './components/TodayMenuSection'
export { KpiSection } from './components/KpiSection'
export { CriticalIngredientsSection } from './components/CriticalIngredientsSection'
export { StockAlertsBanner } from './components/StockAlertsBanner'
export { InsumoTab } from './components/InsumoTab'
export { RecetarioTab } from './components/RecetarioTab'
export { ReportesTab } from './components/ReportesTab'
export { ComprasTab } from './components/ComprasTab'
export { ConfiguracionTab } from './components/ConfiguracionTab'
export { useAdminAuthStore } from './store/admin-auth.store'
export { useAdminDashboardStore } from './store/admin-dashboard.store'
export { useAdminApi } from './hooks/useAdminApi'
export { useAdminSocket } from './hooks/useAdminSocket'
export type {
  AdminTab,
  DailyMenuItem,
  KpiToday,
  CriticalIngredient,
  StockAlertPayload,
  Ingredient,
  MenuCategory,
  RecipeLine,
  MenuItem,
  RecetarioFilter,
  ReportPeriod,
  ReportKpi,
  PaymentMethodStat,
  TopDish,
  ReportData,
  Supplier,
  PurchaseItemDetail,
  Purchase,
  UserRole,
  SystemUser,
  RestaurantTable,
  SystemParams,
} from './types'
