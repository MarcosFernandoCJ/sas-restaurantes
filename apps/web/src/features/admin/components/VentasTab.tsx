import { useState, useEffect, useCallback } from 'react'
import { Spinner } from '@sas/ui'
import { useAdminApi } from '../hooks/useAdminApi'
import type { SalesPage, SaleRecord } from '../types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  in_prep: 'En preparación',
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  in_prep: 'bg-blue-100 text-blue-700',
  ready: 'bg-green-100 text-green-700',
  delivered: 'bg-[#1A6B3C]/10 text-[#1A6B3C]',
  cancelled: 'bg-red-100 text-red-600',
}

const INVOICE_STATUS_CLASS: Record<string, string> = {
  pending: 'text-[#C8410A]',
  paid: 'text-[#1A6B3C] font-semibold',
  voided: 'text-gray-400 line-through',
}

const INVOICE_STATUS_LABEL: Record<string, string> = {
  pending: 'Sin pagar',
  paid: 'Pagado',
  voided: 'Anulado',
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  yape: 'Yape',
  plin: 'Plin',
  other: 'Otro',
}

const TYPE_LABEL: Record<string, string> = {
  dine_in: 'Local',
  delivery: 'Delivery',
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
}

function fmtSoles(n: number): string {
  return 'S/ ' + n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function SaleRow({ sale }: { sale: SaleRecord }) {
  const statusClass = STATUS_CLASS[sale.status] ?? 'bg-gray-100 text-gray-500'
  const invoiceStatusClass = sale.invoice
    ? (INVOICE_STATUS_CLASS[sale.invoice.status] ?? '')
    : 'text-muted'

  return (
    <tr className="border-b border-border hover:bg-surface/60 transition-colors">
      <td className="px-4 py-3 font-mono text-sm font-semibold text-primary">
        #{sale.orderNumber}
        {sale.isAdditional && (
          <span className="ml-1.5 text-[10px] bg-[#A05A2C]/15 text-[#A05A2C] px-1.5 py-0.5 rounded-full font-bold uppercase">
            +
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-primary">
        {sale.table ? `Mesa ${sale.table.number}` : (
          <span className="text-[#C8410A] font-medium">Delivery</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-muted">{fmtDate(sale.createdAt)}</td>
      <td className="px-4 py-3 text-sm text-muted">{fmtTime(sale.createdAt)}</td>
      <td className="px-4 py-3 text-sm text-muted">{sale.waiter.name}</td>
      <td className="px-4 py-3">
        <span className={['text-xs font-medium px-2 py-0.5 rounded-full', statusClass].join(' ')}>
          {STATUS_LABEL[sale.status] ?? sale.status}
        </span>
      </td>
      <td className="px-4 py-3">
        {sale.invoice ? (
          <span className={['text-xs', invoiceStatusClass].join(' ')}>
            {INVOICE_STATUS_LABEL[sale.invoice.status]}
          </span>
        ) : (
          <span className="text-xs text-muted">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted">
        {sale.invoice?.paymentMethod ? METHOD_LABEL[sale.invoice.paymentMethod] : '—'}
      </td>
      <td className="px-4 py-3 text-sm font-mono font-semibold text-right">
        {sale.invoice ? fmtSoles(sale.invoice.total) : <span className="text-muted">—</span>}
      </td>
      <td className="px-4 py-3 text-xs text-muted text-center">{sale.itemCount}</td>
      <td className="px-4 py-3 text-xs text-muted">{TYPE_LABEL[sale.type] ?? sale.type}</td>
    </tr>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number
  total: number
  limit: number
  onPage: (p: number) => void
}

function Pagination({ page, total, limit, onPage }: PaginationProps) {
  const totalPages = Math.ceil(total / limit)
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between mt-4 px-1">
      <p className="text-xs text-muted">
        {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} de {total} pedidos
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ← Anterior
        </button>
        <span className="text-xs text-muted font-mono">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Siguiente →
        </button>
      </div>
    </div>
  )
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

export function VentasTab() {
  const api = useAdminApi()
  const [page, setPage] = useState(1)
  const [sales, setSales] = useState<SalesPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    api
      .get<SalesPage>(`/admin/sales?page=${page}&limit=50`)
      .then(setSales)
      .catch((e: Error) => setError(e.message ?? 'Error al cargar ventas'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-primary">Ventas</h2>
          <p className="text-sm text-muted mt-0.5">Historial completo de pedidos</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="text-xs text-muted hover:text-primary underline"
        >
          Actualizar
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-20">
          <Spinner size="lg" label="Cargando ventas..." />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-red-600 font-medium text-sm mb-3">
            No se pudo cargar el historial
          </p>
          <button type="button" onClick={load} className="text-sm text-muted hover:text-primary underline">
            Reintentar
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && sales && sales.data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <span className="text-6xl select-none" aria-hidden="true">🧾</span>
          <div>
            <h3 className="font-display text-lg font-semibold text-primary mb-1">Sin ventas aún</h3>
            <p className="text-sm text-muted max-w-xs mx-auto">
              El historial de pedidos aparecerá aquí cuando se registren ventas.
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && sales && sales.data.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-border overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider"># Pedido</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Mesa</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Fecha</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Hora</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Mesero</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Pago</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Método</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider text-right">Total</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider text-center">Ítems</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {sales.data.map((sale) => (
                  <SaleRow key={sale.id} sale={sale} />
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={sales.page}
            total={sales.total}
            limit={sales.limit}
            onPage={setPage}
          />
        </>
      )}
    </div>
  )
}
