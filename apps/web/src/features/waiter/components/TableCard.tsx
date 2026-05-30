import type { ApiTable, ActiveOrderSummary } from '../types'

export interface TableCardActions {
  onDetail: (table: ApiTable) => void
  onAdd?: (table: ApiTable) => void
  onPay?: (table: ApiTable) => void
  onServe?: (table: ApiTable) => void
}

type TableState = 'free' | 'occupied' | 'in_prep' | 'ready' | 'unpaid'

function getTableState(table: ApiTable): TableState {
  if (table.orders.length === 0) return 'free'

  const allItems = table.orders.flatMap((o) => o.items)
  const stationItems = allItems.filter((i) => i.assignedArea !== 'waiter')

  const allStationReady =
    stationItems.length > 0 &&
    stationItems.every((i) => i.status === 'ready' || i.status === 'served')
  const anyStationActive = stationItems.some(
    (i) => i.status === 'in_prep' || i.status === 'ready'
  )
  const hasPendingInvoice = table.orders.some((o) => o.invoice?.status === 'pending')

  if (allStationReady) return 'ready'
  if (anyStationActive) return 'in_prep'
  if (hasPendingInvoice) return 'unpaid'
  return 'occupied'
}

const STATE_CONFIG = {
  free: {
    card: 'border-border hover:border-secondary hover:shadow-md',
    badge: 'bg-green-100 text-green-700',
    label: 'Libre',
    dot: 'bg-green-400',
    dotAnimate: '',
  },
  occupied: {
    card: 'border-[#B0C4D8] hover:border-secondary hover:shadow-md',
    badge: 'bg-blue-100 text-blue-700',
    label: 'Tomado',
    dot: 'bg-blue-400',
    dotAnimate: '',
  },
  in_prep: {
    card: 'border-[#2563A8] hover:shadow-md',
    badge: 'bg-blue-100 text-blue-700',
    label: 'En preparación',
    dot: 'bg-blue-500',
    dotAnimate: 'animate-pulse',
  },
  ready: {
    card: 'border-[#1A6B3C] hover:shadow-md',
    badge: 'bg-green-100 text-green-700',
    label: '✓ Listos para llevar',
    dot: 'bg-green-500',
    dotAnimate: '',
  },
  unpaid: {
    card: 'border-[#C8410A] hover:shadow-md',
    badge: 'bg-orange-100 text-[#C8410A]',
    label: 'Falta pagar',
    dot: 'bg-[#C8410A]',
    dotAnimate: 'animate-pulse',
  },
} as const

function ItemPills({ order }: { order: ActiveOrderSummary }) {
  const stationItems = order.items.filter((i) => i.assignedArea !== 'waiter')
  const readyCount = stationItems.filter((i) => i.status === 'ready').length
  const inPrepCount = stationItems.filter((i) => i.status === 'in_prep').length
  const pendingCount = stationItems.filter((i) => i.status === 'pending').length
  const directCount = order.items.filter((i) => i.assignedArea === 'waiter').length

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {pendingCount > 0 && (
        <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
          {pendingCount} pend.
        </span>
      )}
      {inPrepCount > 0 && (
        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
          {inPrepCount} prep.
        </span>
      )}
      {readyCount > 0 && (
        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold">
          {readyCount} listo{readyCount !== 1 ? 's' : ''}
        </span>
      )}
      {directCount > 0 && (
        <span className="text-[10px] bg-[#2563A8]/10 text-[#2563A8] px-1.5 py-0.5 rounded">
          {directCount} directo{directCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}

interface TableCardProps {
  table: ApiTable
  actions: TableCardActions
  /** ID del mesero actualmente logueado; controla qué botones se muestran */
  currentUserId?: string
}

export function TableCard({ table, actions, currentUserId }: TableCardProps) {
  const state = getTableState(table)
  const cfg = STATE_CONFIG[state]
  const hasOrders = table.orders.length > 0
  const hasPendingInvoice = table.orders.some((o) => o.invoice?.status === 'pending')
  const hasReadyItems = table.orders.some((o) =>
    o.items.some((i) => i.status === 'ready')
  )

  // Owner = waiter who placed the main (non-additional) order on this table
  const mainOrder = table.orders.find((o) => !o.isAdditional) ?? table.orders[0]
  const isOwner = !currentUserId || !mainOrder || mainOrder.waiter.id === currentUserId

  return (
    <div
      className={[
        'relative bg-white rounded-2xl border-2 transition-all duration-150 overflow-hidden',
        cfg.card,
      ].join(' ')}
    >
      {/* Clickable card body → Ver detalle */}
      <button
        type="button"
        onClick={() => actions.onDetail(table)}
        className="w-full text-left p-4 active:bg-surface/60 transition-colors"
        aria-label={`Mesa ${table.number} — ${cfg.label}`}
      >
        {/* Number + state badge */}
        <div className="flex items-start justify-between mb-1">
          <span className="font-display text-3xl font-bold text-primary">{table.number}</span>
          <span className={['flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full', cfg.badge].join(' ')}>
            <span className={['w-1.5 h-1.5 rounded-full shrink-0', cfg.dot, cfg.dotAnimate].join(' ')} />
            {cfg.label}
          </span>
        </div>

        <p className="text-xs text-muted font-body mb-2">
          {table.capacity} per. · {table.section ?? 'salón'}
        </p>

        {/* Orders summary with waiter name */}
        {hasOrders && (
          <div className="space-y-2">
            {table.orders.map((order, idx) => (
              <div key={order.id} className={idx > 0 ? 'pt-1.5 border-t border-border/60' : ''}>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-mono font-bold text-primary">#{order.orderNumber}</span>
                  {order.isAdditional && (
                    <span className="text-[10px] bg-[#A05A2C] text-white px-1.5 py-0.5 rounded-full font-bold">
                      ADICIONAL
                    </span>
                  )}
                  {order.invoice?.status === 'pending' && (
                    <span className="text-[10px] text-[#C8410A] font-semibold">· sin pagar</span>
                  )}
                  {/* Waiter attribution */}
                  <span className="text-[10px] text-muted truncate max-w-[80px]">
                    {order.waiter.name}
                  </span>
                </div>
                <ItemPills order={order} />
              </div>
            ))}
          </div>
        )}

        {/* Non-owner notice */}
        {hasOrders && !isOwner && (
          <p className="mt-2 text-[10px] text-muted italic">
            Asignada a {mainOrder?.waiter.name}
          </p>
        )}
      </button>

      {/* Quick action buttons — owner-only for Agregar / Cobrar; Servir for anyone */}
      {hasOrders && (
        <div className="px-3 pb-3 flex flex-wrap gap-1.5">
          {isOwner && actions.onAdd && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); actions.onAdd!(table) }}
              className="flex-1 min-w-0 text-xs font-semibold bg-primary/10 text-primary px-2 py-1.5 rounded-lg hover:bg-primary/20 active:scale-95 transition-all truncate"
            >
              + Agregar
            </button>
          )}
          {isOwner && actions.onPay && hasPendingInvoice && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); actions.onPay!(table) }}
              className="flex-1 min-w-0 text-xs font-semibold bg-[#C8410A] text-white px-2 py-1.5 rounded-lg hover:bg-[#C8410A]/90 active:scale-95 transition-all truncate"
            >
              Cobrar
            </button>
          )}
          {actions.onServe && hasReadyItems && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); actions.onServe!(table) }}
              className="flex-1 min-w-0 text-xs font-semibold bg-[#1A6B3C] text-white px-2 py-1.5 rounded-lg hover:bg-[#1A6B3C]/90 active:scale-95 transition-all truncate"
            >
              Servir
            </button>
          )}
        </div>
      )}

      {/* Free table: simple tap to start order */}
      {!hasOrders && (
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={() => actions.onDetail(table)}
            className="w-full text-xs font-semibold text-secondary border border-secondary/30 rounded-lg px-2 py-1.5 hover:bg-secondary/5 active:scale-95 transition-all"
          >
            + Nuevo pedido
          </button>
        </div>
      )}
    </div>
  )
}
