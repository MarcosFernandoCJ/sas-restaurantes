import { useEffect, useState } from 'react'
import type { ItemReadyNotification } from '../types'

interface ToastOverlayProps {
  notification: ItemReadyNotification
  onDismiss: () => void
}

export function ToastOverlay({ notification, onDismiss }: ToastOverlayProps) {
  const [visible, setVisible] = useState(false)
  const tableLabel = notification.tableNumber
    ? `Mesa ${notification.tableNumber}`
    : `Pedido #${notification.orderNumber}`

  useEffect(() => {
    // Trigger enter animation on next tick
    const enter = requestAnimationFrame(() => setVisible(true))
    // Auto-dismiss after 4.5s (0.5s fade-in + 3.5s visible + 0.5s fade-out)
    const dismiss = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 500)
    }, 4000)
    return () => {
      cancelAnimationFrame(enter)
      clearTimeout(dismiss)
    }
  }, [onDismiss])

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={[
        'fixed top-4 right-4 z-50 flex items-start gap-3 bg-[#1A6B3C] text-white rounded-xl shadow-xl px-4 py-3 max-w-xs',
        'transition-all duration-500',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2',
      ].join(' ')}
    >
      <span className="text-2xl shrink-0 leading-tight" aria-hidden="true">🔔</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-tight">
          {notification.isReminder ? '⏰ Recordatorio' : 'Listo para recoger'}
        </p>
        <p className="text-sm opacity-90 truncate">{notification.menuItemName}</p>
        <p className="text-xs opacity-70 mt-0.5">{tableLabel}</p>
      </div>
      <button
        type="button"
        onClick={() => { setVisible(false); setTimeout(onDismiss, 300) }}
        className="text-white/60 hover:text-white text-lg leading-none shrink-0 -mt-0.5"
        aria-label="Cerrar notificación"
      >
        ✕
      </button>
    </div>
  )
}
