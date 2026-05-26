import { useEffect, useRef, useCallback } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useWaiterAuthStore } from '../store/waiter-auth.store'
import { useNotificationsStore } from '../store/notifications.store'
import type { ItemReadyNotification } from '../types'

const SOCKET_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

interface ItemReadyPayload {
  itemId: string
  orderId: string
  menuItemName: string
  tableId: string | null
  tableNumber: number | null
  orderNumber: number
  waiterId: string
  isReminder?: boolean
}

interface TableUpdatedPayload {
  tableId: string
  orderId: string
}

export function useWaiterSocket(onTableUpdated?: (payload: TableUpdatedPayload) => void) {
  const socketRef = useRef<Socket | null>(null)
  const token = useWaiterAuthStore((s) => s.token)
  const addNotification = useNotificationsStore((s) => s.add)

  // Request browser notification permission on first mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => { /* permission denied — silent */ })
    }
  }, [])

  useEffect(() => {
    if (!token) return

    const socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
    })

    socketRef.current = socket

    socket.on('order:item:ready', (payload: ItemReadyPayload) => {
      const notification: ItemReadyNotification = {
        ...payload,
        receivedAt: new Date(),
      }

      addNotification(notification)

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const tableLabel = payload.tableNumber ? `Mesa ${payload.tableNumber}` : `Pedido #${payload.orderNumber}`
        new Notification(payload.isReminder ? '⏰ Recordatorio — Pedido sin recoger' : 'Pedido listo para recoger', {
          body: `${payload.menuItemName} — ${tableLabel}`,
          icon: '/favicon.ico',
          tag: payload.itemId, // deduplicates browser notifications for same item
        })
      }
    })

    socket.on('table:updated', (payload: TableUpdatedPayload) => {
      onTableUpdated?.(payload)
    })

    socket.on('connect_error', () => {
      // Silent fail
    })

    return () => {
      socket.disconnect()
    }
  }, [token, addNotification, onTableUpdated])

  const confirmItemServed = useCallback((itemId: string) => {
    socketRef.current?.emit('item:served', { itemId })
  }, [])

  return { confirmItemServed }
}