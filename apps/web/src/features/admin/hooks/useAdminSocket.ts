import { useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useAdminAuthStore } from '../store/admin-auth.store'
import { useAdminDashboardStore } from '../store/admin-dashboard.store'
import type { StockAlertPayload, KpiToday } from '../types'


interface OrderConfirmedPayload {
  orderId: string
  total: number
}

export function useAdminSocket() {
  const socketRef = useRef<Socket | null>(null)
  const token = useAdminAuthStore((s) => s.token)
  const { setKpi, addStockAlert, incrementOrders, addSales, incrementItemsServed } =
    useAdminDashboardStore()

  useEffect(() => {
    if (!token) return

    const socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
    })

    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join:room', 'room:admin')
    })

    // Full KPI refresh — backend can push this after any invoice:paid
    socket.on('kpi:update', (kpi: KpiToday) => {
      setKpi(kpi)
    })

    // Incremental: new order confirmed & paid
    socket.on('order:confirmed', (payload: OrderConfirmedPayload) => {
      incrementOrders()
      addSales(payload.total)
    })

    // Incremental: item served by waiter
    socket.on('order:item:served', () => {
      incrementItemsServed()
    })

    // Ingredient dropped below threshold
    socket.on('stock:alert', (payload: StockAlertPayload) => {
      addStockAlert(payload)
    })

    socket.on('connect_error', () => {
      // silent — KPI data already loaded from REST on mount
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [token, setKpi, addStockAlert, incrementOrders, addSales, incrementItemsServed])
}
