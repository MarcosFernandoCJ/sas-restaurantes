import React, { useEffect, useState, useCallback } from 'react'
import { Spinner } from '@sas/ui'
import type { ApiTable } from '../types'
import { TableCard, type TableCardActions } from './TableCard'
import { useApi } from '../hooks/useApi'

interface TableBoardProps {
  onSelectTable: (table: ApiTable) => void
  onAddToTable?: (table: ApiTable) => void
  onPayTable?: (table: ApiTable) => void
  onServeTable?: (table: ApiTable) => void
  refreshSignal?: number
  currentUserId?: string
}

export function TableBoard({
  onSelectTable,
  onAddToTable,
  onPayTable,
  onServeTable,
  refreshSignal,
  currentUserId,
}: TableBoardProps) {
  const { get } = useApi()
  const [tables, setTables] = useState<ApiTable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTables = useCallback(async () => {
    try {
      const data = await get<ApiTable[]>('/tables')
      setTables(data)
      setError(null)
    } catch {
      setError('No se pudo cargar las mesas')
    } finally {
      setLoading(false)
    }
  }, [get])

  useEffect(() => {
    void fetchTables()
  }, [fetchTables, refreshSignal])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" label="Cargando mesas..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-red-600 font-body">{error}</p>
        <button onClick={fetchTables} className="text-sm text-secondary underline">
          Reintentar
        </button>
      </div>
    )
  }

  const freeTables = tables.filter((t) => t.orders.length === 0)
  const occupiedTables = tables.filter((t) => t.orders.length > 0)

  return (
    <div className="space-y-6">
      {occupiedTables.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            En servicio ({occupiedTables.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {occupiedTables.map((table) => {
              const cardActions: TableCardActions = {
                onDetail: onSelectTable,
                onAdd: onAddToTable,
                onPay: onPayTable,
                onServe: onServeTable,
              }
              return <TableCard key={table.id} table={table} actions={cardActions} currentUserId={currentUserId} />
            })}
          </div>
        </section>
      )}

      {freeTables.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            Disponibles ({freeTables.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {freeTables.map((table) => {
              const cardActions: TableCardActions = {
                onDetail: onSelectTable,
              }
              return <TableCard key={table.id} table={table} actions={cardActions} />
            })}
          </div>
        </section>
      )}

      {tables.length === 0 && (
        <p className="text-center text-muted py-12 font-body">No hay mesas configuradas.</p>
      )}
    </div>
  )
}
