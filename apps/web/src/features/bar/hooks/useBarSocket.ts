import { useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useBarStore } from '../store/bar.store'
import type {
  BarOrder,
  OrderCreatedPayload,
  OrderItemClaimedPayload,
  OrderItemReadyKitchenPayload,
  OrderItemUpdatedPayload,
  OrderDeliveredPayload,
  JourneyStartedPayload,
  JourneyEndedPayload,
} from '../types'

const REMOVAL_DELAY_MS = 3000

function payloadToOrder(payload: OrderCreatedPayload): BarOrder {
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

export function useBarSocket() {
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
  } = useBarStore()

  // Initial load: fetch active bar queue via HTTP
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL ?? '/api'}/bar/queue`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: OrderCreatedPayload[]) => setOrders(data.map(payloadToOrder)))
      .catch(() => { /* silent — queue starts empty if API unreachable */ })
  }, [setOrders])

  useEffect(() => {
    const socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join:room', 'room:bar')
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

    socket.on('order:delivered', (payload: OrderDeliveredPayload) => {
      markOrderRemoving(payload.orderId)
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
      removalTimers.current.forEach((t) => clearTimeout(t))
      removalTimers.current.clear()
    }
  }, [addOrder, claimItem, markItemReady, markItemUpdated, markOrderRemoving, removeOrder, setJourney])

  const claimItemAction = (itemId: string) => {
    socketRef.current?.emit('item:claim', { itemId })
  }

  const markItemReadyAction = (itemId: string) => {
    socketRef.current?.emit('item:ready', { itemId })
  }

  return { claimItemAction, markItemReadyAction }
}
