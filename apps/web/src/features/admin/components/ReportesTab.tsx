// import { useState, useEffect } from 'react'
// import {
//   PieChart,
//   Pie,
//   Cell,
//   Tooltip,
//   Legend,
//   ResponsiveContainer,
// } from 'recharts'
// import { Card, Spinner } from '@sas/ui'
// import { useAdminApi } from '../hooks/useAdminApi'
// import type { ReportPeriod, ReportData } from '../types'

// // ─── Constants ────────────────────────────────────────────────────────────────

// const PERIODS: { id: ReportPeriod; label: string }[] = [
//   { id: 'today', label: 'Hoy' },
//   { id: 'week', label: 'Semana' },
//   { id: 'month', label: 'Mes' },
//   { id: 'year', label: 'Año' },
// ]

// const METHOD_LABELS: Record<string, string> = {
//   cash: 'Efectivo',
//   card: 'Tarjeta',
//   yape: 'Yape',
//   plin: 'Plin',
//   other: 'Otro',
// }

// // Palette: carbón, zafiro, hierba, ámbar, humo
// const PIE_COLORS = ['#1B2B3A', '#2563A8', '#1A6B3C', '#E8A838', '#8C9BAA']

// // ─── Helpers ─────────────────────────────────────────────────────────────────

// function fmtSoles(n: number): string {
//   return (
//     'S/ ' +
//     n.toLocaleString('es-PE', {
//       minimumFractionDigits: 2,
//       maximumFractionDigits: 2,
//     })
//   )
// }

// // ─── KPI Card ─────────────────────────────────────────────────────────────────

// interface KpiCardProps {
//   label: string
//   value: string
//   sub?: string
//   highlight?: boolean
// }

// function KpiCard({ label, value, sub, highlight }: KpiCardProps) {
//   return (
//     <div
//       className={[
//         'rounded-xl border p-5',
//         highlight
//           ? 'border-secondary/40 bg-secondary/5'
//           : 'border-border bg-white',
//       ].join(' ')}
//     >
//       <p className="text-xs font-medium text-muted uppercase tracking-wider">
//         {label}
//       </p>
//       <p
//         className={[
//           'text-2xl font-mono font-semibold mt-1.5',
//           highlight ? 'text-secondary' : 'text-primary',
//         ].join(' ')}
//       >
//         {value}
//       </p>
//       {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
//     </div>
//   )
// }

// // ─── Period filter bar ────────────────────────────────────────────────────────

// interface PeriodFilterProps {
//   value: ReportPeriod
//   onChange: (p: ReportPeriod) => void
// }

// function PeriodFilter({ value, onChange }: PeriodFilterProps) {
//   return (
//     <div className="inline-flex items-center bg-white border border-border rounded-lg p-1 gap-1">
//       {PERIODS.map((p) => (
//         <button
//           type="button"
//           key={p.id}
//           onClick={() => onChange(p.id)}
//           className={[
//             'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
//             value === p.id
//               ? 'bg-primary text-white shadow-sm'
//               : 'text-muted hover:text-primary',
//           ].join(' ')}
//         >
//           {p.label}
//         </button>
//       ))}
//     </div>
//   )
// }

// // ─── Top dishes list ──────────────────────────────────────────────────────────

// interface TopDishesProps {
//   dishes: ReportData['topDishes']
// }

// function TopDishes({ dishes }: TopDishesProps) {
//   if (dishes.length === 0) {
//     return (
//       <p className="text-sm text-muted text-center py-10">
//         Sin datos en este período
//       </p>
//     )
//   }

//   const medals = ['🥇', '🥈', '🥉']

//   return (
//     <div className="space-y-3">
//       {dishes.slice(0, 3).map((dish, i) => (
//         <div
//           key={dish.menuItemId}
//           className="flex items-center gap-3 p-3 rounded-lg bg-[#FAFAF8] border border-border"
//         >
//           <span className="text-xl flex-shrink-0" aria-hidden="true">
//             {medals[i] ?? `#${i + 1}`}
//           </span>
//           <div className="flex-1 min-w-0">
//             <p className="font-medium text-primary truncate">{dish.name}</p>
//             <p className="text-xs text-muted">
//               {dish.quantitySold} unidades vendidas
//             </p>
//           </div>
//           <p className="font-mono text-sm font-semibold text-secondary flex-shrink-0">
//             {fmtSoles(dish.totalRevenue)}
//           </p>
//         </div>
//       ))}
//     </div>
//   )
// }

// // ─── Payment pie chart ────────────────────────────────────────────────────────

// interface PaymentPieProps {
//   methods: ReportData['paymentMethods']
// }

// function PaymentPie({ methods }: PaymentPieProps) {
//   const data = methods.map((m) => ({
//     name: METHOD_LABELS[m.method] ?? m.method,
//     value: m.total,
//     count: m.count,
//   }))

//   if (data.length === 0) {
//     return (
//       <p className="text-sm text-muted text-center py-10">
//         Sin ventas en este período
//       </p>
//     )
//   }

//   return (
//     <ResponsiveContainer width="100%" height={260}>
//       <PieChart>
//         <Pie
//           data={data}
//           cx="50%"
//           cy="50%"
//           innerRadius={65}
//           outerRadius={105}
//           paddingAngle={3}
//           dataKey="value"
//         >
//           {data.map((_entry, i) => (
//             <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
//           ))}
//         </Pie>
//         <Tooltip
//           formatter={(value) =>
//             [fmtSoles(typeof value === 'number' ? value : 0), 'Total'] as [string, string]
//           }
//         />
//         <Legend
//           formatter={(value: string) => (
//             <span className="text-xs font-body text-primary">{value}</span>
//           )}
//         />
//       </PieChart>
//     </ResponsiveContainer>
//   )
// }

// // ─── Tab ─────────────────────────────────────────────────────────────────────

export function ReportesTab() {
  return (
    <div className="flex items-center justify-center py-20 text-muted text-sm">
      Reportes — próximamente
    </div>
  )
}

// export function ReportesTab() {
//   const api = useAdminApi()
//   const [period, setPeriod] = useState<ReportPeriod>('today')
//   const [data, setData] = useState<ReportData | null>(null)
//   const [loading, setLoading] = useState(true)
//   const [error, setError] = useState<string | null>(null)

//   useEffect(() => {
//     setLoading(true)
//     setError(null)
//     api
//       .get<ReportData>(`/admin/reports?period=${period}`)
//       .then(setData)
//       .catch((e: Error) =>
//         setError(e.message ?? 'Error al cargar reportes')
//       )
//       .finally(() => setLoading(false))
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [period])

//   return (
//     <div className="space-y-6">
//       {/* Header */}
//       <div className="flex flex-wrap items-center justify-between gap-4">
//         <div>
//           <h2 className="font-display text-xl font-semibold text-primary">
//             Reportes
//           </h2>
//           <p className="text-sm text-muted mt-0.5">
//             Ingresos, costos y rendimiento
//           </p>
//         </div>
//         <PeriodFilter value={period} onChange={setPeriod} />
//       </div>

//       {/* Loading state */}
//       {loading && (
//         <div className="flex justify-center py-20">
//           <Spinner size="lg" label="Cargando reportes..." />
//         </div>
//       )}

//       {/* Error state */}
//       {!loading && error && (
//         <div className="rounded-xl border border-state-danger/30 bg-state-danger/5 p-8 text-center">
//           <p className="text-state-danger font-medium">{error}</p>
//           <button
//             type="button"
//             onClick={() => setPeriod(period)}
//             className="mt-3 text-sm text-muted hover:text-primary underline"
//           >
//             Reintentar
//           </button>
//         </div>
//       )}

//       {/* Data */}
//       {!loading && !error && data && (
//         <>
//           {/* KPI row */}
//           <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
//             <KpiCard label="Ingresos" value={fmtSoles(data.kpi.ingresos)} />
//             <KpiCard label="Costos" value={fmtSoles(data.kpi.costos)} />
//             <KpiCard
//               label="Ganancias"
//               value={fmtSoles(data.kpi.ganancias)}
//               highlight
//             />
//             <KpiCard
//               label="Margen"
//               value={`${data.kpi.margen.toFixed(1)}%`}
//               sub={
//                 data.kpi.margen >= 30
//                   ? '✓ Saludable'
//                   : data.kpi.margen >= 15
//                   ? '~ Aceptable'
//                   : '⚠ Bajo'
//               }
//               highlight={data.kpi.margen >= 30}
//             />
//           </div>

//           {/* Charts row */}
//           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//             <Card header="Métodos de pago">
//               <PaymentPie methods={data.paymentMethods} />
//             </Card>

//             <Card header="Top 3 platos más vendidos">
//               <TopDishes dishes={data.topDishes} />
//             </Card>
//           </div>
//         </>
//       )}
//     </div>
//   )
// }
