import { useEffect, useState, useCallback } from 'react'
import { Button, Spinner } from '@sas/ui'
import type { ApiOrder, ApiTable } from '../types'
import { useApi } from '../hooks/useApi'
import { useCartStore } from '../store/cart.store'
import { useNotificationsStore } from '../store/notifications.store'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_prep: 'En preparación',
  ready: 'Listo ✓',
  served: 'Entregado',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-[#B0C4D8]',
  in_prep: 'text-[#2563A8] font-semibold',
  ready: 'text-[#1A6B3C] font-bold animate-pulse',
  served: 'text-muted line-through',
}

interface TableDetailProps {
  table: ApiTable
  onClose: () => void
  onNewOrder: () => void
  onServeItem?: (itemId: string) => void
}

export function TableDetail({ table, onClose, onNewOrder, onServeItem }: TableDetailProps) {
  const { get } = useApi()
  const setAdditional = useCartStore((s) => s.setAdditional)
  const notifications = useNotificationsStore((s) => s.notifications)
  const dismissNotification = useNotificationsStore((s) => s.dismiss)

  const [orders, setOrders] = useState<ApiOrder[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOrders = useCallback(() => {
    get<{ data: ApiOrder[] }>(`/orders?tableId=${table.id}&limit=10`)
      .then((r) => setOrders(r.data.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled')))
      .catch(() => { /* noop */ })
      .finally(() => setLoading(false))
  }, [table.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // When a notification arrives for an item in one of this table's orders,
  // update that item's status to 'ready' without a full refetch
  useEffect(() => {
    if (notifications.length === 0) return
    const orderIds = new Set(orders.map((o) => o.id))
    const relevant = notifications.filter((n) => orderIds.has(n.orderId))
    if (relevant.length === 0) return

    setOrders((prev) =>
      prev.map((o) => ({
        ...o,
        items: o.items.map((i) => {
          const match = relevant.find((n) => n.itemId === i.id)
          return match ? { ...i, status: 'ready' as const } : i
        }),
      }))
    )
  }, [notifications]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddMore = () => {
    const activeOrder = orders[0]
    if (activeOrder) setAdditional(activeOrder.id)
    onNewOrder()
  }

  const handleServe = (itemId: string) => {
    onServeItem?.(itemId)
    dismissNotification(itemId)
    // Optimistic UI
    setOrders((prev) =>
      prev.map((o) => ({
        ...o,
        items: o.items.map((i) => i.id === itemId ? { ...i, status: 'served' as const } : i),
      }))
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-primary">Mesa {table.number}</h2>
          <p className="text-sm text-muted">{table.capacity} personas · {table.section ?? 'salón'}</p>
        </div>
        <button type="button" onClick={onClose} className="text-muted hover:text-primary transition-colors text-xl" aria-label="Cerrar">
          ✕
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Spinner size="md" label="Cargando pedido..." /></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-muted mb-4">No hay pedidos activos en esta mesa.</p>
          <Button variant="primary" onClick={onNewOrder}>Nuevo pedido</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className={[
              'rounded-xl border-2 overflow-hidden',
              order.isAdditional ? 'border-[#A05A2C]' : 'border-border',
            ].join(' ')}>
              <div className="bg-surface px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-primary">#{order.orderNumber}</span>
                  {order.isAdditional && (
                    <span className="text-xs bg-[#A05A2C] text-white px-2 py-0.5 rounded-full font-semibold">ADICIONAL</span>
                  )}
                </div>
                <span className="text-xs text-muted">
                  {new Date(order.createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <ul className="px-4 py-2 space-y-2">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex-1">
                      <span className="font-mono font-bold text-primary text-sm mr-2">×{item.quantity}</span>
                      <span className="font-body text-primary text-sm">{item.menuItem.name}</span>
                      {item.notes && <p className="text-xs text-accent">⚠ {item.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={['text-xs', STATUS_COLORS[item.status] ?? ''].join(' ')}>
                        {STATUS_LABELS[item.status] ?? item.status}
                      </span>
                      {item.status === 'ready' && (
                        <button
                          type="button"
                          onClick={() => handleServe(item.id)}
                          className="text-xs bg-[#1A6B3C] text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-[#1A6B3C]/90 active:scale-95 transition-all"
                        >
                          Entregar
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <Button variant="secondary" onClick={handleAddMore} className="w-full">
            + Agregar más ítems
          </Button>
        </div>
      )}
    </div>
  )
}