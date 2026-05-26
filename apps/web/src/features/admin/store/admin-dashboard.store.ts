import { create } from 'zustand'
import type { KpiToday, StockAlertPayload } from '../types'

interface AdminDashboardState {
  kpi: KpiToday
  stockAlerts: StockAlertPayload[]
  setKpi: (kpi: KpiToday) => void
  incrementOrders: () => void
  addSales: (amount: number) => void
  incrementItemsServed: () => void
  addStockAlert: (alert: StockAlertPayload) => void
  dismissAlert: (ingredientId: string) => void
}

const INITIAL_KPI: KpiToday = {
  salesToday: 0,
  salesYesterday: 0,
  ordersToday: 0,
  itemsServedToday: 0,
}

export const useAdminDashboardStore = create<AdminDashboardState>((set) => ({
  kpi: INITIAL_KPI,
  stockAlerts: [],

  setKpi: (kpi) => set({ kpi }),

  incrementOrders: () =>
    set((s) => ({ kpi: { ...s.kpi, ordersToday: s.kpi.ordersToday + 1 } })),

  addSales: (amount) =>
    set((s) => ({ kpi: { ...s.kpi, salesToday: s.kpi.salesToday + amount } })),

  incrementItemsServed: () =>
    set((s) => ({ kpi: { ...s.kpi, itemsServedToday: s.kpi.itemsServedToday + 1 } })),

  addStockAlert: (alert) =>
    set((s) => ({
      stockAlerts: [
        alert,
        ...s.stockAlerts.filter((a) => a.ingredientId !== alert.ingredientId),
      ],
    })),

  dismissAlert: (ingredientId) =>
    set((s) => ({
      stockAlerts: s.stockAlerts.filter((a) => a.ingredientId !== ingredientId),
    })),
}))
