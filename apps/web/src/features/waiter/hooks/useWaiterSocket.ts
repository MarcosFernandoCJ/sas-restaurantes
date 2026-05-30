import { useEffect, useRef, useCallback } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useWaiterAuthStore } from '../store/waiter-auth.store'
import { useNotificationsStore } from '../store/notifications.store'
import { useWaiterJourneyStore } from '../store/journey.store'
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

interface JourneyStartedPayload {
  sessionId: string
  startedAt: string
}

export function useWaiterSocket(onTableUpdated?: (payload: TableUpdatedPayload) => void) {
  const socketRef = useRef<Socket | null>(null)
  const token = useWaiterAuthStore((s) => s.token)
  const addNotification = useNotificationsStore((s) => s.add)
  const { setOpen, setClosed } = useWaiterJourneyStore()

  // Request browser notification permission on first mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => { /* permission denied — silent */ })
    }
  }, [])

  // Fetch current journey state on mount (so we know if local is open/closed without waiting for a WS event)
  useEffect(() => {
    if (!token) return
    fetch(`${SOCKET_URL}/journey/current`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: { id: string; startedAt: string } | null) => {
        if (data?.id) {
          setOpen(data.id, data.startedAt)
        } else {
          setClosed()
        }
      })
      .catch(() => {
        // If fetch fails (network error), treat as unknown — leave isOpen: null
        // so the UI shows a loading/retry state rather than blocking.
        setClosed()
      })
  }, [token, setOpen, setClosed])

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
        new Notification(payload.isReminder ? '⏰ Recordatorio — Pedido sin recoger' : 'Plato listo para recoger', {
          body: `${payload.menuItemName} — ${tableLabel}`,
          icon: '/favicon.ico',
          tag: payload.itemId, // deduplicates browser notifications for same item
        })
      }
    })

    socket.on('table:updated', (payload: TableUpdatedPayload) => {
      onTableUpdated?.(payload)
    })

    // Journey state sync — update store immediately so WaiterPage gates re-render
    socket.on('journey:started', (payload: JourneyStartedPayload) => {
      setOpen(payload.sessionId, payload.startedAt)
    })

    socket.on('journey:ended', () => {
      setClosed()
    })

    socket.on('connect_error', () => {
      // Silent fail
    })

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [token, addNotification, onTableUpdated, setOpen, setClosed])

  const confirmItemServed = useCallback((itemId: string) => {
    socketRef.current?.emit('item:served', { itemId })
  }, [])

  return { confirmItemServed }
}
