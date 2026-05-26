import { useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useKitchenStore } from '../store/kitchen.store'
import type {
  KitchenOrder,
  OrderCreatedPayload,
  OrderItemClaimedPayload,
  OrderItemUpdatedPayload,
} from '../types'

const SOCKET_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

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
  const { addOrder, setOrders, claimItem, markItemUpdated } = useKitchenStore()

  // Fetch existing active orders on mount (kitchen has no JWT — uses unauthenticated endpoint)
  useEffect(() => {
    fetch(`${SOCKET_URL}/kitchen/queue`)
      .then((r) => r.json())
      .then((data: OrderCreatedPayload[]) => setOrders(data.map(payloadToOrder)))
      .catch(() => { /* silent — queue starts empty if API unreachable */ })
  }, [setOrders])

  useEffect(() => {
    // Kitchen display connects without auth (PIN-based access, no user account)
    const socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
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

    socket.on('order:item:updated', (payload: OrderItemUpdatedPayload) => {
      markItemUpdated(payload.orderId, payload.itemId, {
        notes: payload.notes,
        quantity: payload.quantity,
        menuItemName: payload.menuItemName,
      })
    })

    socket.on('connect_error', () => {
      // Silent — kitchen still shows orders from initial fetch
    })

    return () => {
      socket.disconnect()
    }
  }, [addOrder, claimItem, markItemUpdated])

  const claimItemAction = (itemId: string) => {
    socketRef.current?.emit('item:claim', { itemId })
  }

  const markItemReadyAction = (itemId: string) => {
    socketRef.current?.emit('item:ready', { itemId })
  }

  return { claimItemAction, markItemReadyAction }
}