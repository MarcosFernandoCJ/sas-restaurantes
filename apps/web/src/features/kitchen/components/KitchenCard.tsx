import React from 'react'
import { Badge, Button } from '@sas/ui'
import type { KitchenOrder, KitchenOrderItem } from '../types'
import { useElapsedTime, formatElapsed } from '../hooks/useElapsedTime'

const WARN_THRESHOLD_MS = 15 * 60 * 1000

// ─── Item row ────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: KitchenOrderItem
  onClaim: () => void
  onReady: () => void
  onClearUpdate: () => void
}

function ItemRow({ item, onClaim, onReady, onClearUpdate }: ItemRowProps) {
  return (
    <li className="flex items-start justify-between gap-3 py-2.5 border-b border-[#1E2F3F] last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xl font-bold text-[#B0C4D8] tabular-nums">
            ×{item.quantity}
          </span>
          <span className="text-lg text-white font-semibold">
            {item.menuItemName}
          </span>
          {item.hasUpdate && (
            <span
              className="animate-pulse inline-block text-xs font-bold bg-accent text-[#0F1A24] px-2 py-0.5 rounded-full uppercase tracking-wide"
              role="status"
              aria-label="Este ítem fue actualizado por el mesero"
            >
              ACTUALIZADO
            </span>
          )}
        </div>
        {item.notes && (
          <p className="text-sm text-accent mt-1 leading-snug">
            ⚠ {item.notes}
          </p>
        )}
        {item.assignedChefName && item.status === 'in_prep' && (
          <p className="text-xs text-[#8C9BAA] mt-0.5">Chef: {item.assignedChefName}</p>
        )}
      </div>

      <div className="flex-shrink-0 flex items-center">
        {item.status === 'pending' && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onClaim()
              if (item.hasUpdate) onClearUpdate()
            }}
            aria-label={`Tomar ${item.menuItemName}`}
          >
            Tomar
          </Button>
        )}
        {item.status === 'in_prep' && (
          <Button
            variant="primary"
            size="sm"
            onClick={onReady}
            aria-label={`Marcar listo ${item.menuItemName}`}
          >
            Listo
          </Button>
        )}
        {item.status === 'ready' && (
          <span className="text-sm font-bold text-[#1A6B3C]" aria-label="Listo para llevar">
            ✓ Listo
          </span>
        )}
        {item.status === 'served' && (
          <span className="text-xs text-[#8C9BAA]" aria-label="Entregado">
            Entregado
          </span>
        )}
      </div>
    </li>
  )
}

// ─── Card ────────────────────────────────────────────────────────────────────

export interface KitchenCardProps {
  order: KitchenOrder
  onClaimItem: (itemId: string) => void
  onMarkItemReady: (itemId: string) => void
  onClearUpdate: (orderId: string, itemId: string) => void
}

export function KitchenCard({
  order,
  onClaimItem,
  onMarkItemReady,
  onClearUpdate,
}: KitchenCardProps) {
  const elapsed = useElapsedTime(order.createdAt)

  const allPending = order.items.every((i) => i.status === 'pending')
  const anyInPrep = order.items.some((i) => i.status === 'in_prep')
  const allDone = order.items.every((i) => i.status === 'ready' || i.status === 'served')
  const isTimerCritical = allPending && elapsed > WARN_THRESHOLD_MS

  const borderClass = order.isAdditional
    ? 'border-[#A05A2C]'
    : allDone
    ? 'border-[#1A6B3C]'
    : anyInPrep
    ? 'border-[#2563A8]'
    : 'border-[#1E2F3F]'

  return (
    <article
      className={[
        'bg-[#162230] rounded-xl border-2 shadow-lg flex flex-col overflow-hidden',
        borderClass,
      ].join(' ')}
      aria-label={`Pedido #${order.orderNumber}`}
    >
      {/* Header */}
      <header className="px-4 py-3 flex items-center justify-between gap-3 border-b border-[#1E2F3F]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display text-2xl font-bold text-white">
            #{order.orderNumber}
          </span>

          {order.isAdditional ? (
            <span className="text-xs font-bold bg-[#A05A2C] text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
              ADICIONAL
            </span>
          ) : order.type === 'delivery' ? (
            <Badge variant="delivery">DELIVERY</Badge>
          ) : (
            <span className="text-sm font-semibold text-[#B0C4D8]">
              MESA {order.tableNumber ?? '—'}
            </span>
          )}
        </div>

        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <time
            className={[
              'text-2xl font-mono font-bold tabular-nums leading-none',
              isTimerCritical ? 'text-red-400' : anyInPrep ? 'text-[#2563A8]' : 'text-[#B0C4D8]',
            ].join(' ')}
            dateTime={order.createdAt.toISOString()}
            aria-label={`Tiempo en cola: ${formatElapsed(elapsed)}`}
          >
            {formatElapsed(elapsed)}
          </time>
          <span className="text-xs text-[#8C9BAA]">
            {order.createdAt.toLocaleTimeString('es-PE', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </header>

      {/* Body — items list */}
      <div className="flex-1 px-4 py-1">
        <ul role="list" aria-label="Ítems del pedido">
          {order.items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onClaim={() => onClaimItem(item.id)}
              onReady={() => onMarkItemReady(item.id)}
              onClearUpdate={() => onClearUpdate(order.id, item.id)}
            />
          ))}
        </ul>

        {order.notes && (
          <p className="mt-2 pb-2 text-sm text-accent border-t border-[#1E2F3F] pt-2">
            📝 {order.notes}
          </p>
        )}
      </div>

      {/* Footer — status summary */}
      <footer className="px-4 py-2 border-t border-[#1E2F3F] flex items-center gap-2 flex-wrap">
        {allDone ? (
          <span className="text-sm font-bold text-[#1A6B3C]">
            ✓ Todos listos
          </span>
        ) : (
          <>
            {order.items.filter((i) => i.status === 'pending').length > 0 && (
              <span className="text-xs text-[#8C9BAA]">
                {order.items.filter((i) => i.status === 'pending').length} pendiente
                {order.items.filter((i) => i.status === 'pending').length !== 1 ? 's' : ''}
              </span>
            )}
            {order.items.filter((i) => i.status === 'in_prep').length > 0 && (
              <span className="text-xs text-[#2563A8] font-semibold">
                {order.items.filter((i) => i.status === 'in_prep').length} en preparación
              </span>
            )}
            {order.items.filter((i) => i.status === 'ready').length > 0 && (
              <span className="text-xs text-[#1A6B3C] font-semibold">
                {order.items.filter((i) => i.status === 'ready').length} listo
                {order.items.filter((i) => i.status === 'ready').length !== 1 ? 's' : ''}
              </span>
            )}
          </>
        )}
      </footer>
    </article>
  )
}