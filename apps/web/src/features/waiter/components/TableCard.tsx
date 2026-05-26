import React from 'react'
import type { ApiTable } from '../types'

interface TableCardProps {
  table: ApiTable
  onSelect: (table: ApiTable) => void
}

function getTableState(table: ApiTable) {
  if (table.orders.length === 0) return 'free'
  const order = table.orders[0]
  if (order.items.every((i) => i.status === 'ready')) return 'ready'
  if (order.items.some((i) => i.status === 'in_prep' || i.status === 'ready')) return 'in_prep'
  return 'occupied'
}

const STATE_STYLES = {
  free: {
    card: 'bg-white border-border hover:border-secondary hover:shadow-md',
    badge: 'bg-green-100 text-green-700',
    label: 'Libre',
    dot: 'bg-green-400',
  },
  occupied: {
    card: 'bg-white border-[#B0C4D8] hover:border-secondary hover:shadow-md',
    badge: 'bg-blue-100 text-blue-700',
    label: 'En curso',
    dot: 'bg-blue-400',
  },
  in_prep: {
    card: 'bg-white border-[#2563A8] hover:shadow-md',
    badge: 'bg-blue-100 text-blue-700',
    label: 'En preparación',
    dot: 'bg-blue-500 animate-pulse',
  },
  ready: {
    card: 'bg-white border-[#1A6B3C] hover:shadow-md',
    badge: 'bg-green-100 text-green-700',
    label: '✓ Listo para llevar',
    dot: 'bg-green-500',
  },
} as const

export function TableCard({ table, onSelect }: TableCardProps) {
  const state = getTableState(table)
  const styles = STATE_STYLES[state]
  const activeOrder = table.orders[0]

  const readyCount = activeOrder?.items.filter((i) => i.status === 'ready').length ?? 0
  const inPrepCount = activeOrder?.items.filter((i) => i.status === 'in_prep').length ?? 0
  const pendingCount = activeOrder?.items.filter((i) => i.status === 'pending').length ?? 0

  return (
    <button
      type="button"
      onClick={() => onSelect(table)}
      className={[
        'relative text-left w-full rounded-2xl border-2 p-5 transition-all duration-150 active:scale-95 cursor-pointer',
        styles.card,
      ].join(' ')}
      aria-label={`Mesa ${table.number} — ${styles.label}`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="font-display text-3xl font-bold text-primary">{table.number}</span>
        <span className={['flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full', styles.badge].join(' ')}>
          <span className={['w-1.5 h-1.5 rounded-full', styles.dot].join(' ')} />
          {styles.label}
        </span>
      </div>

      <p className="text-xs text-muted font-body">
        {table.capacity} personas · {table.section ?? 'salón'}
      </p>

      {activeOrder && (
        <div className="mt-3 pt-3 border-t border-border space-y-0.5">
          <p className="text-xs font-semibold text-primary font-mono">Pedido #{activeOrder.orderNumber}</p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {pendingCount > 0 && (
              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
              </span>
            )}
            {inPrepCount > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                {inPrepCount} en prep
              </span>
            )}
            {readyCount > 0 && (
              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold">
                {readyCount} listo{readyCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      )}
    </button>
  )
}