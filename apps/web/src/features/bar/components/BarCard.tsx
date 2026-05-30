import { Button } from '@sas/ui'
import type { BarOrder, BarOrderItem } from '../types'
import { useElapsedTime, formatElapsed } from '../../kitchen/hooks/useElapsedTime'

const WARN_THRESHOLD_MS = 10 * 60 * 1000 // 10 min (bebidas se preparan más rápido)

interface ItemRowProps {
  item: BarOrderItem
  isCompactMode: boolean
  onClaim: () => void
  onReady: () => void
  onClearUpdate: () => void
}

function ItemRow({ item, isCompactMode, onClaim, onReady, onClearUpdate }: ItemRowProps) {
  const isDone = item.status === 'ready' || item.status === 'served'

  return (
    <li
      className={[
        'flex items-start justify-between gap-3 py-2.5 border-b border-[#1E2F3F] last:border-0',
        isDone ? 'opacity-50' : '',
      ].join(' ')}
    >
      <div className={['flex-1 min-w-0', isDone ? 'line-through decoration-[#8C9BAA]' : ''].join(' ')}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xl font-bold text-[#B0C4D8] tabular-nums">×{item.quantity}</span>
          <span className="text-lg text-white font-semibold">{item.menuItemName}</span>
          {item.hasUpdate && (
            <span
              className="animate-pulse inline-block text-xs font-bold bg-accent text-[#0F1A24] px-2 py-0.5 rounded-full uppercase tracking-wide"
              role="status"
            >
              ACTUALIZADO
            </span>
          )}
          {item.status === 'in_prep' && (
            <span className="text-xs font-semibold text-[#2563A8]">Preparando</span>
          )}
        </div>
        {item.notes && <p className="text-sm text-accent mt-1">⚠ {item.notes}</p>}
      </div>

      <div className="flex-shrink-0 flex items-center">
        {!isCompactMode && (
          <>
            {item.status === 'pending' && (
              <Button variant="secondary" size="sm" onClick={onClaim}>
                Preparar
              </Button>
            )}
            {item.status === 'in_prep' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => { onReady(); if (item.hasUpdate) onClearUpdate() }}
              >
                ✓ Lista
              </Button>
            )}
            {item.status === 'ready' && (
              <span className="text-sm font-bold text-[#1A6B3C]">✓ Lista</span>
            )}
            {item.status === 'served' && (
              <span className="text-xs text-[#8C9BAA]">Entregada</span>
            )}
          </>
        )}
        {isCompactMode && <span className="text-sm font-bold text-[#1A6B3C]">✓</span>}
      </div>
    </li>
  )
}

export interface BarCardProps {
  order: BarOrder
  isCompactMode?: boolean
  isRemoving?: boolean
  onMarkItemReady: (itemId: string) => void
  onClaimItem: (itemId: string) => void
  onClearUpdate: (orderId: string, itemId: string) => void
}

export function BarCard({
  order,
  isCompactMode = false,
  isRemoving = false,
  onMarkItemReady,
  onClaimItem,
  onClearUpdate,
}: BarCardProps) {
  const elapsed = useElapsedTime(order.createdAt)

  const anyPending = order.items.some((i) => i.status === 'pending')
  const anyInPrep = order.items.some((i) => i.status === 'in_prep')
  const allReady = order.items.length > 0 && order.items.every((i) => i.status === 'ready' || i.status === 'served')
  const isTimerCritical = (anyPending || anyInPrep) && elapsed > WARN_THRESHOLD_MS
  const isDelivery = order.type === 'delivery'

  const borderClass = isDelivery
    ? 'border-[#C8410A]'
    : order.isAdditional
    ? 'border-[#A05A2C]'
    : allReady
    ? 'border-[#1A6B3C]'
    : anyInPrep
    ? 'border-[#2563A8]'
    : 'border-[#1E2F3F]'

  return (
    <article
      className={[
        'rounded-xl border-2 shadow-lg flex flex-col overflow-hidden',
        'transition-all duration-700 ease-out',
        isCompactMode ? 'bg-[#0F1A24] opacity-80' : 'bg-[#162230]',
        borderClass,
        isRemoving ? 'opacity-0 -translate-y-2 pointer-events-none scale-95' : '',
      ].join(' ')}
      aria-label={`Pedido #${order.orderNumber}`}
    >
      <header className={[
        'px-4 py-3 flex items-center justify-between gap-3 border-b border-[#1E2F3F]',
        isDelivery ? 'bg-[#C8410A]/10' : '',
      ].join(' ')}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display text-2xl font-bold text-white">#{order.orderNumber}</span>
          {isDelivery ? (
            <span className="flex items-center gap-1 text-sm font-bold bg-[#C8410A] text-white px-2.5 py-1 rounded-lg uppercase tracking-wide">
              🛵 DELIVERY
            </span>
          ) : order.isAdditional ? (
            <span className="text-xs font-bold bg-[#A05A2C] text-white px-2 py-0.5 rounded-full uppercase">
              ADICIONAL
            </span>
          ) : (
            <span className="text-sm font-semibold text-[#B0C4D8]">
              MESA {order.tableNumber ?? '—'}
            </span>
          )}
          {isCompactMode && (
            <span className="text-xs font-bold text-[#1A6B3C] bg-[#1A6B3C]/10 px-2 py-0.5 rounded-full border border-[#1A6B3C]/30">
              ESPERANDO MESERO
            </span>
          )}
        </div>

        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <time
            className={[
              'text-2xl font-mono font-bold tabular-nums leading-none',
              isTimerCritical ? 'text-red-400 animate-pulse' : anyInPrep ? 'text-[#2563A8]' : 'text-[#B0C4D8]',
            ].join(' ')}
          >
            {formatElapsed(elapsed)}
          </time>
          <span className="text-xs text-[#8C9BAA]">
            {order.createdAt.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </header>

      <div className="flex-1 px-4 py-1">
        <ul role="list">
          {order.items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              isCompactMode={isCompactMode}
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

      <footer className="px-4 py-2 border-t border-[#1E2F3F] flex items-center gap-2 flex-wrap">
        {allReady ? (
          <span className="text-sm font-bold text-[#1A6B3C]">
            ✓ Bar listo — esperando confirmación del mesero
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
                {order.items.filter((i) => i.status === 'in_prep').length} preparando
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
