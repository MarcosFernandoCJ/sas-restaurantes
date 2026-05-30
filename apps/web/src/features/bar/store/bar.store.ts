import { create } from 'zustand'
import type { BarOrder, BarOrderItem, ItemStatus, JourneyState } from '../types'

interface BarState {
  orders: BarOrder[]
  journey: JourneyState
  removingOrderIds: string[]

  setOrders: (orders: BarOrder[]) => void
  addOrder: (order: BarOrder) => void
  removeOrder: (orderId: string) => void
  markOrderRemoving: (orderId: string) => void

  claimItem: (orderId: string, itemId: string, chefName: string | null) => void
  markItemReady: (orderId: string, itemId: string) => void
  updateItemStatus: (orderId: string, itemId: string, status: ItemStatus) => void
  markItemUpdated: (
    orderId: string,
    itemId: string,
    patch: Partial<Pick<BarOrderItem, 'notes' | 'quantity' | 'menuItemName'>>
  ) => void
  clearItemUpdated: (orderId: string, itemId: string) => void

  setJourney: (journey: JourneyState) => void
}

export const useBarStore = create<BarState>((set) => ({
  orders: [],
  journey: { sessionId: null, isOpen: false, startedAt: null },
  removingOrderIds: [],

  setOrders: (orders) => set({ orders }),

  addOrder: (order) =>
    set((state) => ({
      orders: state.orders.some((o) => o.id === order.id)
        ? state.orders
        : [...state.orders, order],
    })),

  removeOrder: (orderId) =>
    set((state) => ({
      orders: state.orders.filter((o) => o.id !== orderId),
      removingOrderIds: state.removingOrderIds.filter((id) => id !== orderId),
    })),

  markOrderRemoving: (orderId) =>
    set((state) => ({
      removingOrderIds: state.removingOrderIds.includes(orderId)
        ? state.removingOrderIds
        : [...state.removingOrderIds, orderId],
    })),

  claimItem: (orderId, itemId, chefName) =>
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id !== orderId
          ? order
          : {
              ...order,
              items: order.items.map((item) => {
                if (item.id !== itemId) return item
                if (item.status === 'ready' || item.status === 'served') return item
                return { ...item, status: 'in_prep' as const, assignedChefName: chefName ?? undefined }
              }),
            }
      ),
    })),

  markItemReady: (orderId, itemId) =>
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id !== orderId
          ? order
          : {
              ...order,
              items: order.items.map((item) =>
                item.id !== itemId ? item : { ...item, status: 'ready' as const }
              ),
            }
      ),
    })),

  updateItemStatus: (orderId, itemId, status) =>
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id !== orderId
          ? order
          : {
              ...order,
              items: order.items.map((item) =>
                item.id !== itemId ? item : { ...item, status }
              ),
            }
      ),
    })),

  markItemUpdated: (orderId, itemId, patch) =>
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id !== orderId
          ? order
          : {
              ...order,
              items: order.items.map((item) =>
                item.id !== itemId ? item : { ...item, ...patch, hasUpdate: true }
              ),
            }
      ),
    })),

  clearItemUpdated: (orderId, itemId) =>
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id !== orderId
          ? order
          : {
              ...order,
              items: order.items.map((item) =>
                item.id !== itemId ? item : { ...item, hasUpdate: false }
              ),
            }
      ),
    })),

  setJourney: (journey) => set({ journey }),
}))
