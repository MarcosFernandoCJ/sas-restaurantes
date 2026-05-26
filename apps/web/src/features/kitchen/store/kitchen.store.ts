import { create } from 'zustand'
import type { KitchenOrder, KitchenOrderItem, ItemStatus } from '../types'

interface KitchenState {
  orders: KitchenOrder[]
  setOrders: (orders: KitchenOrder[]) => void
  addOrder: (order: KitchenOrder) => void
  claimItem: (orderId: string, itemId: string, chefName: string) => void
  updateItemStatus: (orderId: string, itemId: string, status: ItemStatus) => void
  markItemUpdated: (
    orderId: string,
    itemId: string,
    patch: Partial<Pick<KitchenOrderItem, 'notes' | 'quantity' | 'menuItemName'>>
  ) => void
  clearItemUpdated: (orderId: string, itemId: string) => void
}

export const useKitchenStore = create<KitchenState>((set) => ({
  orders: [],

  setOrders: (orders) => set({ orders }),

  addOrder: (order) =>
    set((state) => ({ orders: [...state.orders, order] })),

  claimItem: (orderId, itemId, chefName) =>
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id !== orderId
          ? order
          : {
              ...order,
              items: order.items.map((item) =>
                item.id !== itemId
                  ? item
                  : { ...item, status: 'in_prep' as const, assignedChefName: chefName }
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
}))