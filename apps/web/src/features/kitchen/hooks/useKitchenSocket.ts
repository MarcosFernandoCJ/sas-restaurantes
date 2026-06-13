import { useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useKitchenStore } from '../store/kitchen.store'
import type {
  KitchenOrder,
  OrderCreatedPayload,
  OrderItemClaimedPayload,
  OrderItemReadyKitchenPayload,
  OrderItemUpdatedPayload,
  OrderDeliveredPayload,
  JourneyStartedPayload,
  JourneyEndedPayload,
} from '../types'

const REMOVAL_DELAY_MS = 3000

function payloadToOrder(payload: OrderCreatedPayload): KitchenOrder {
  return {
    id: payload.id,
    orderNumber: payload.orderNumber,
    type: payload.type,
    tableNumber: payload.tableNumber,
    isAdditional: payload.isAdditional,
    parentOrderId: payload.parentOrderId,
    notes: payload.notes,
    createdAt: new Date(payload.createdAt),
    items: payload.items.map((item) => ({
      ...item,
      assignedChefName: undefined,
      hasUpdate: false,
    })),
  }
}

export function useKitchenSocket() {
  const socketRef = useRef<Socket | null>(null)
  const removalTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const {
    addOrder,
    setOrders,
    removeOrder,
    markOrderRemoving,
    claimItem,
    markItemReady,
    markItemUpdated,
    setJourney,
  } = useKitchenStore()

  // Initial load: fetch active queue via HTTP (kitchen has no JWT).
  // cache: 'no-store' bypasses service worker cache so restarts always get fresh DB state.
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL ?? '/api'}/kitchen/queue`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: OrderCreatedPayload[]) => setOrders(data.map(payloadToOrder)))
      .catch(() => { /* silent — queue starts empty if API unreachable */ })
  }, [setOrders])

  // WebSocket connection — single instance, proper cleanup on unmount
  useEffect(() => {
    const socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join:room', 'room:kitchen')
    })

    socket.on('order:created', (payload: OrderCreatedPayload) => {
      addOrder(payloadToOrder(payload))
    })

    socket.on('order:additional', (payload: OrderCreatedPayload) => {
      addOrder(payloadToOrder({ ...payload, isAdditional: true }))
    })

    socket.on('order:item:claimed', (payload: OrderItemClaimedPayload) => {
      claimItem(payload.orderId, payload.itemId, payload.chefName)
    })

    socket.on('order:item:ready', (payload: OrderItemReadyKitchenPayload) => {
      markItemReady(payload.orderId, payload.itemId)
    })

    socket.on('order:item:updated', (payload: OrderItemUpdatedPayload) => {
      markItemUpdated(payload.orderId, payload.itemId, {
        notes: payload.notes,
        quantity: payload.quantity,
        menuItemName: payload.menuItemName,
      })
    })

    // When waiter confirms all items delivered: fade the card out, then remove after delay
    socket.on('order:delivered', (payload: OrderDeliveredPayload) => {
      markOrderRemoving(payload.orderId)
      // Cancel any existing timer for this order (idempotent)
      const existing = removalTimers.current.get(payload.orderId)
      if (existing) clearTimeout(existing)
      const timer = setTimeout(() => {
        removeOrder(payload.orderId)
        removalTimers.current.delete(payload.orderId)
      }, REMOVAL_DELAY_MS)
      removalTimers.current.set(payload.orderId, timer)
    })

    socket.on('journey:started', (payload: JourneyStartedPayload) => {
      setJourney({ sessionId: payload.sessionId, isOpen: true, startedAt: payload.startedAt })
    })

    socket.on('journey:ended', (_payload: JourneyEndedPayload) => {
      setJourney({ sessionId: null, isOpen: false, startedAt: null })
    })

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      // Clear all pending removal timers on unmount
      removalTimers.current.forEach((t) => clearTimeout(t))
      removalTimers.current.clear()
    }
  }, [addOrder, claimItem, markItemReady, markItemUpdated, markOrderRemoving, removeOrder, setJourney])

  // Chef clicks "Empezar preparación" → pending → in_prep
  const claimItemAction = (itemId: string) => {
    socketRef.current?.emit('item:claim', { itemId })
  }

  // Chef clicks "✓ Listo" → in_prep → ready (auto-claims if still pending)
  const markItemReadyAction = (itemId: string) => {
    socketRef.current?.emit('item:ready', { itemId })
  }

  return { claimItemAction, markItemReadyAction }
}
