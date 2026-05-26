import { useEffect, useState } from 'react'
import { useNotificationsStore } from '../store/notifications.store'
import type { ItemReadyNotification } from '../types'

function useElapsedMinutes(since: Date): number {
  const [minutes, setMinutes] = useState(() => Math.floor((Date.now() - since.getTime()) / 60000))
  useEffect(() => {
    const id = setInterval(() => setMinutes(Math.floor((Date.now() - since.getTime()) / 60000)), 30000)
    return () => clearInterval(id)
  }, [since])
  return minutes
}

function NotificationRow({
  notification,
  onServe,
  onNavigate,
}: {
  notification: ItemReadyNotification
  onServe: (itemId: string) => void
  onNavigate: (tableId: string) => void
}) {
  const elapsed = useElapsedMinutes(notification.receivedAt)
  const tableLabel = notification.tableNumber ? `Mesa ${notification.tableNumber}` : `Pedido #${notification.orderNumber}`

  return (
    <li className="flex items-center gap-3 py-2.5 border-b border-[#1A6B3C]/20 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-sm font-body text-primary truncate">{notification.menuItemName}</span>
          {notification.isReminder && (
            <span className="text-xs bg-[#D4860A] text-white px-1.5 py-0.5 rounded font-semibold shrink-0">Recordatorio</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <button
            type="button"
            onClick={() => notification.tableId && onNavigate(notification.tableId)}
            disabled={!notification.tableId}
            className="text-xs text-[#2563A8] underline-offset-2 hover:underline disabled:no-underline disabled:text-muted transition-colors"
          >
            {tableLabel}
          </button>
          <span className="text-xs text-muted font-mono">
            {elapsed === 0 ? 'ahora' : `${elapsed} min`}
            {elapsed >= 3 && <span className="text-[#C8410A] ml-1 font-semibold">— demorado</span>}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onServe(notification.itemId)}
        className="shrink-0 bg-[#1A6B3C] text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-[#1A6B3C]/90 active:scale-95 transition-all min-w-[76px]"
      >
        Entregar
      </button>
    </li>
  )
}

interface NotificationsPanelProps {
  onServeItem: (itemId: string) => void
  onNavigateToTable: (tableId: string) => void
}

export function NotificationsPanel({ onServeItem, onNavigateToTable }: NotificationsPanelProps) {
  const notifications = useNotificationsStore((s) => s.notifications)
  const dismissAll = useNotificationsStore((s) => s.dismissAll)

  if (notifications.length === 0) return null

  return (
    <div className="mb-5 bg-[#1A6B3C]/10 border border-[#1A6B3C]/40 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1A6B3C]/15">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#1A6B3C] animate-pulse" />
          <h2 className="font-semibold text-[#1A6B3C] font-body text-sm">
            {notifications.length === 1
              ? '1 plato listo para recoger'
              : `${notifications.length} platos listos para recoger`}
          </h2>
        </div>
        <button
          type="button"
          onClick={dismissAll}
          className="text-xs text-muted hover:text-primary transition-colors"
        >
          Descartar todos
        </button>
      </div>

      {/* List */}
      <ul className="px-4">
        {notifications.map((n) => (
          <NotificationRow
            key={`${n.itemId}-${n.receivedAt.getTime()}`}
            notification={n}
            onServe={onServeItem}
            onNavigate={onNavigateToTable}
          />
        ))}
      </ul>
    </div>
  )
}