import { useAdminDashboardStore } from '../store/admin-dashboard.store'

const STATUS_LABEL: Record<'low' | 'critical' | 'out', string> = {
  low:      'Stock bajo',
  critical: 'Stock crítico',
  out:      'Agotado',
}

export function StockAlertsBanner() {
  const stockAlerts = useAdminDashboardStore((s) => s.stockAlerts)
  const dismissAlert = useAdminDashboardStore((s) => s.dismissAlert)

  if (stockAlerts.length === 0) return null

  return (
    <div
      role="alert"
      className="rounded-xl border border-state-danger/40 bg-red-50 px-4 py-3 space-y-2"
    >
      <p className="text-sm font-semibold text-state-danger flex items-center gap-2">
        <span aria-hidden="true">⚠️</span>
        {stockAlerts.length === 1
          ? '1 alerta de insumo'
          : `${stockAlerts.length} alertas de insumos`}
      </p>
      <ul className="space-y-1.5">
        {stockAlerts.map((alert) => (
          <li
            key={alert.ingredientId}
            className="flex items-center justify-between gap-4 text-sm"
          >
            <span className="text-primary">
              <strong>{alert.ingredientName}</strong>
              {' — '}
              {STATUS_LABEL[alert.status]}
              {' '}
              <span className="font-mono text-muted">
                ({alert.stockQty.toFixed(3)} restante · mín {alert.minStockQty.toFixed(3)})
              </span>
            </span>
            <button
              onClick={() => dismissAlert(alert.ingredientId)}
              aria-label={`Descartar alerta de ${alert.ingredientName}`}
              className="flex-shrink-0 text-xs text-muted hover:text-primary underline"
            >
              Descartar
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
