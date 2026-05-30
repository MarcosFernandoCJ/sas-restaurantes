import { useState, useEffect } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { Card, Spinner } from '@sas/ui'
import { useAdminApi } from '../hooks/useAdminApi'
import type { ReportPeriod, ReportData } from '../types'

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIODS: { id: ReportPeriod; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
  { id: 'year', label: 'Año' },
]

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  yape: 'Yape',
  plin: 'Plin',
  other: 'Otro',
}

const PIE_COLORS = ['#1B2B3A', '#2563A8', '#1A6B3C', '#E8A838', '#8C9BAA']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtSoles(n: number): string {
  return (
    'S/ ' +
    n.toLocaleString('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  )
}

function fmtMins(secs: number): string {
  if (secs <= 0) return '—'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  highlight?: boolean
}

function KpiCard({ label, value, sub, highlight }: KpiCardProps) {
  return (
    <div
      className={[
        'rounded-xl border p-5',
        highlight
          ? 'border-secondary/40 bg-secondary/5'
          : 'border-border bg-white',
      ].join(' ')}
    >
      <p className="text-xs font-medium text-muted uppercase tracking-wider">
        {label}
      </p>
      <p
        className={[
          'text-2xl font-mono font-semibold mt-1.5',
          highlight ? 'text-secondary' : 'text-primary',
        ].join(' ')}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  )
}

// ─── Period filter bar ────────────────────────────────────────────────────────

interface PeriodFilterProps {
  value: ReportPeriod
  onChange: (p: ReportPeriod) => void
}

function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  return (
    <div className="inline-flex items-center bg-white border border-border rounded-lg p-1 gap-1">
      {PERIODS.map((p) => (
        <button
          type="button"
          key={p.id}
          onClick={() => onChange(p.id)}
          className={[
            'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            value === p.id
              ? 'bg-primary text-white shadow-sm'
              : 'text-muted hover:text-primary',
          ].join(' ')}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

// ─── Top dishes list ──────────────────────────────────────────────────────────

interface TopDishesProps {
  dishes: ReportData['topDishes']
}

function TopDishes({ dishes }: TopDishesProps) {
  if (dishes.length === 0) {
    return (
      <p className="text-sm text-muted text-center py-10">
        Sin datos en este período
      </p>
    )
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-3">
      {dishes.slice(0, 3).map((dish, i) => (
        <div
          key={dish.menuItemId}
          className="flex items-center gap-3 p-3 rounded-lg bg-[#FAFAF8] border border-border"
        >
          <span className="text-xl flex-shrink-0" aria-hidden="true">
            {medals[i] ?? `#${i + 1}`}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-primary truncate">{dish.name}</p>
            <p className="text-xs text-muted">
              {dish.quantitySold} unidades vendidas
            </p>
          </div>
          <p className="font-mono text-sm font-semibold text-secondary flex-shrink-0">
            {fmtSoles(dish.totalRevenue)}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Payment pie chart ────────────────────────────────────────────────────────

interface PaymentPieProps {
  methods: ReportData['paymentMethods']
}

function PaymentPie({ methods }: PaymentPieProps) {
  const data = methods.map((m) => ({
    name: METHOD_LABELS[m.method] ?? m.method,
    value: m.total,
    count: m.count,
  }))

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted text-center py-10">
        Sin ventas en este período
      </p>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={65}
          outerRadius={105}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((_entry, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) =>
            [fmtSoles(typeof value === 'number' ? value : 0), 'Total'] as [string, string]
          }
        />
        <Legend
          formatter={(value: string) => (
            <span className="text-xs font-body text-primary">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ─── Hourly bar chart ─────────────────────────────────────────────────────────

interface HourlyChartProps {
  data: ReportData['hourlyBreakdown']
}

function HourlyChart({ data }: HourlyChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted text-center py-10">
        Sin datos en este período
      </p>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          formatter={(value: number, name: string) => {
            if (name === 'revenue') return [fmtSoles(value), 'Ingresos']
            return [value, 'Pedidos']
          }}
          labelFormatter={(label) => `Hora: ${label}`}
        />
        <Bar dataKey="orders" fill="#1B2B3A" radius={[3, 3, 0, 0]} name="orders" />
        <Bar dataKey="revenue" fill="#E8A838" radius={[3, 3, 0, 0]} name="revenue" />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <span className="text-6xl select-none" aria-hidden="true">📊</span>
      <div>
        <h3 className="font-display text-lg font-semibold text-primary mb-1">
          Sin datos disponibles aún
        </h3>
        <p className="text-sm text-muted max-w-xs mx-auto">
          Los reportes aparecerán cuando existan ventas registradas.
        </p>
      </div>
    </div>
  )
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

export function ReportesTab() {
  const api = useAdminApi()
  const [period, setPeriod] = useState<ReportPeriod>('today')
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api
      .get<ReportData>(`/admin/reports?period=${period}`)
      .then(setData)
      .catch((e: Error) =>
        setError(e.message ?? 'Error al cargar reportes')
      )
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  const isEmpty = data ? data.kpi.ordersCount === 0 : false

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-primary">
            Reportes
          </h2>
          <p className="text-sm text-muted mt-0.5">
            Ingresos, costos y rendimiento
          </p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-20">
          <Spinner size="lg" label="Cargando reportes..." />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-red-600 font-medium text-sm mb-3">
            No se pudieron cargar los reportes
          </p>
          <button
            type="button"
            onClick={() => setPeriod(period)}
            className="text-sm text-muted hover:text-primary underline"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && isEmpty && <EmptyState />}

      {/* Data */}
      {!loading && !error && data && !isEmpty && (
        <>
          {/* KPI row — 5 cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard
              label="Pedidos"
              value={String(data.kpi.ordersCount)}
            />
            <KpiCard label="Ingresos" value={fmtSoles(data.kpi.ingresos)} />
            <KpiCard label="Costos" value={fmtSoles(data.kpi.costos)} />
            <KpiCard
              label="Ganancias"
              value={fmtSoles(data.kpi.ganancias)}
              highlight
            />
            <KpiCard
              label="Margen"
              value={`${data.kpi.margen.toFixed(1)}%`}
              sub={
                data.kpi.margen >= 30
                  ? '✓ Saludable'
                  : data.kpi.margen >= 15
                  ? '~ Aceptable'
                  : '⚠ Bajo'
              }
              highlight={data.kpi.margen >= 30}
            />
          </div>

          {/* Hourly chart + Payment pie */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card header="Pedidos e ingresos por hora">
              <div className="flex items-center gap-4 mb-3">
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <span className="w-3 h-3 rounded-sm bg-primary inline-block" />
                  Pedidos
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <span className="w-3 h-3 rounded-sm bg-accent inline-block" />
                  Ingresos (S/)
                </span>
              </div>
              <HourlyChart data={data.hourlyBreakdown} />
            </Card>

            <Card header="Métodos de pago">
              <PaymentPie methods={data.paymentMethods} />
            </Card>
          </div>

          {/* Top dishes + Operational metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card header="Top 3 platos más vendidos">
              <TopDishes dishes={data.topDishes} />
            </Card>

            <Card header="Rendimiento operativo">
              <div className="space-y-4 py-2">
                <div className="flex items-center justify-between p-4 rounded-xl bg-[#FAFAF8] border border-border">
                  <div>
                    <p className="text-xs font-medium text-muted uppercase tracking-wider">
                      Tiempo promedio de preparación
                    </p>
                    <p className="text-2xl font-mono font-semibold text-primary mt-1">
                      {fmtMins(data.operational.avgPrepSecs)}
                    </p>
                  </div>
                  <span className="text-3xl select-none" aria-hidden="true">⏱</span>
                </div>

                {data.operational.avgPrepMin > 0 && (
                  <p className="text-xs text-muted px-1">
                    {data.operational.avgPrepMin <= 10
                      ? '✓ Dentro del objetivo (≤ 10 min)'
                      : data.operational.avgPrepMin <= 20
                      ? '~ Aceptable (10–20 min)'
                      : '⚠ Supera el objetivo (> 20 min)'}
                  </p>
                )}

                {data.operational.avgPrepSecs === 0 && (
                  <p className="text-sm text-muted text-center py-6">
                    Sin datos de preparación en este período
                  </p>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
