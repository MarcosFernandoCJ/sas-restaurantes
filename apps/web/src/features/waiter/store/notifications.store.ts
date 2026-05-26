import { create } from 'zustand'
import type { ItemReadyNotification } from '../types'

interface NotificationsState {
  notifications: ItemReadyNotification[]
  add: (n: ItemReadyNotification) => void
  dismiss: (itemId: string) => void
  dismissAll: () => void
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  add: (n) => set((s) => ({ notifications: [n, ...s.notifications] })),
  dismiss: (itemId) => set((s) => ({ notifications: s.notifications.filter((n) => n.itemId !== itemId) })),
  dismissAll: () => set({ notifications: [] }),
}))