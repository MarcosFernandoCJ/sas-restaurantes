import { useEffect, useState } from 'react'
import { Card, Spinner } from '@sas/ui'
import { useAdminApi } from '../hooks/useAdminApi'
import { useAdminDashboardStore } from '../store/admin-dashboard.store'
import type { KpiToday } from '../types'

export function KpiSection() {
  const api = useAdminApi()
  const { kpi, setKpi } = useAdminDashboardStore()
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    api
      .get<KpiToday>('/admin/kpi/today')
      .then((data) => {
        setKpi(data)
        setLastUpdated(new Date())
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    // Poll every 60s as fallback when socket isn't pushing kpi:update
    const interval = setInterval(() => {
      api
        .get<KpiToday>('/admin/kpi/today')
        .then((data) => {
          setKpi(data)
          setLastUpdated(new Date())
        })
        .catch(() => {})
    }, 60_000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const salesDiff =
    kpi.salesYesterday > 0
      ? ((kpi.salesToday - kpi.salesYesterday) / kpi.salesYesterday) * 100
      : null

  const timeLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <Card
      header={
        <div className="flex items-center justify-between">
          <span className="font-semibold text-primary">📈 Seguimiento de Hoy</span>
          {timeLabel && (
            <span className="text-xs text-muted font-mono">Actualizado {timeLabel}</span>
          )}
        </div>
      }
    >
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner size="md" label="Cargando indicadores..." />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label="Ventas del día"
            value={`S/ ${kpi.salesToday.toFixed(2)}`}
            sub={
              salesDiff !== null
                ? `${salesDiff >= 0 ? '+' : ''}${salesDiff.toFixed(1)}% vs ayer`
                : 'Sin datos de ayer'
            }
            subColor={
              salesDiff === null
                ? 'text-muted'
                : salesDiff >= 0
                  ? 'text-state-ready'
                  : 'text-state-danger'
            }
            icon="💰"
          />

          <KpiCard
            label="Órdenes"
            value={String(kpi.ordersToday)}
            sub="pedidos confirmados"
            icon="📋"
          />

          <KpiCard
            label="Platos servidos"
            value={String(kpi.itemsServedToday)}
            sub="ítems entregados"
            icon="🍗"
          />
        </div>
      )}
    </Card>
  )
}

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  subColor?: string
  icon: string
}

function KpiCard({ label, value, sub, subColor = 'text-muted', icon }: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-muted text-xs font-medium uppercase tracking-wide">
        <span aria-hidden="true">{icon}</span>
        <span>{label}</span>
      </div>
      <p className="font-display text-3xl font-bold text-primary tabular-nums">{value}</p>
      {sub && (
        <p className={['text-xs font-medium', subColor].join(' ')}>{sub}</p>
      )}
    </div>
  )
}
