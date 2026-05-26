import { create } from 'zustand'
import type { CartItem, OrderType } from '../types'

interface CartState {
  tableId: string | null
  tableNumber: number | null
  type: OrderType
  parentOrderId: string | null
  isAdditional: boolean
  items: CartItem[]
  notes: string
  step: 'food' | 'drinks' | 'summary' | 'payment' | 'idle'

  setTable: (tableId: string, tableNumber: number) => void
  setDelivery: () => void
  setAdditional: (parentOrderId: string) => void
  addItem: (item: Omit<CartItem, 'quantity' | 'notes'>) => void
  removeItem: (menuItemId: string) => void
  updateQuantity: (menuItemId: string, qty: number) => void
  updateNotes: (menuItemId: string, notes: string) => void
  setOrderNotes: (notes: string) => void
  setStep: (step: CartState['step']) => void
  clear: () => void
}

const EMPTY: Pick<CartState, 'tableId' | 'tableNumber' | 'type' | 'parentOrderId' | 'isAdditional' | 'items' | 'notes' | 'step'> = {
  tableId: null,
  tableNumber: null,
  type: 'dine_in',
  parentOrderId: null,
  isAdditional: false,
  items: [],
  notes: '',
  step: 'idle',
}

export const useCartStore = create<CartState>((set) => ({
  ...EMPTY,

  setTable: (tableId, tableNumber) =>
    set({ tableId, tableNumber, type: 'dine_in', isAdditional: false, parentOrderId: null, step: 'food', items: [], notes: '' }),

  setDelivery: () =>
    set({ tableId: null, tableNumber: null, type: 'delivery', isAdditional: false, parentOrderId: null, step: 'food', items: [], notes: '' }),

  setAdditional: (parentOrderId) =>
    set((s) => ({ parentOrderId, isAdditional: true, step: 'food', items: [], notes: '', tableId: s.tableId, tableNumber: s.tableNumber })),

  addItem: (item) =>
    set((s) => {
      const existing = s.items.find((i) => i.menuItemId === item.menuItemId)
      if (existing) {
        return { items: s.items.map((i) => i.menuItemId === item.menuItemId ? { ...i, quantity: i.quantity + 1 } : i) }
      }
      return { items: [...s.items, { ...item, quantity: 1, notes: '' }] }
    }),

  removeItem: (menuItemId) =>
    set((s) => ({ items: s.items.filter((i) => i.menuItemId !== menuItemId) })),

  updateQuantity: (menuItemId, qty) =>
    set((s) => ({
      items: qty <= 0
        ? s.items.filter((i) => i.menuItemId !== menuItemId)
        : s.items.map((i) => i.menuItemId === menuItemId ? { ...i, quantity: qty } : i),
    })),

  updateNotes: (menuItemId, notes) =>
    set((s) => ({ items: s.items.map((i) => i.menuItemId === menuItemId ? { ...i, notes } : i) })),

  setOrderNotes: (notes) => set({ notes }),

  setStep: (step) => set({ step }),

  clear: () => set(EMPTY),
}))