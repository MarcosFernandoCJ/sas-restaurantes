import { useState, useCallback } from 'react'
import { TableBoard } from '@/features/waiter/components/TableBoard'
import { TableDetail } from '@/features/waiter/components/TableDetail'
import { OrderFlow } from '@/features/waiter/components/OrderFlow'
import { NotificationsPanel } from '@/features/waiter/components/NotificationsPanel'
import { useWaiterAuthStore } from '@/features/waiter/store/waiter-auth.store'
import { useCartStore } from '@/features/waiter/store/cart.store'
import { useWaiterSocket } from '@/features/waiter/hooks/useWaiterSocket'
import type { ApiTable } from '@/features/waiter/types'

type Panel = 'board' | 'detail' | 'order'

export function WaiterPage() {
  const user = useWaiterAuthStore((s) => s.user)
  const logout = useWaiterAuthStore((s) => s.logout)
  const setTable = useCartStore((s) => s.setTable)
  const setDelivery = useCartStore((s) => s.setDelivery)

  const [panel, setPanel] = useState<Panel>('board')
  const [selectedTable, setSelectedTable] = useState<ApiTable | null>(null)
  const [refreshSignal, setRefreshSignal] = useState(0)

  const refresh = useCallback(() => setRefreshSignal((n) => n + 1), [])

  // Navigate to a table's detail by tableId (called from NotificationsPanel)
  const handleNavigateToTable = useCallback((tableId: string) => {
    setRefreshSignal((n) => n + 1) // refresh board first so table data is fresh
    // We don't have the full ApiTable object from just an ID, so fetch via board re-render
    // and open the detail when the user taps the table. For now, open board so user can tap.
    setPanel('board')
    // Highlight: after refresh the board will show the table with "ready" status, user taps it
    // A future enhancement could auto-open the detail here using a tableId lookup.
    void tableId
  }, [])

  // When the waiter socket receives table:updated, refresh board and if the table is open, refetch
  const handleTableUpdated = useCallback(({ tableId }: { tableId: string; orderId: string }) => {
    refresh()
    if (selectedTable?.id === tableId && panel === 'detail') {
      // Re-mount TableDetail by toggling — simplest way to trigger a fresh fetch
      setRefreshSignal((n) => n + 1)
    }
  }, [selectedTable, panel, refresh])

  const { confirmItemServed } = useWaiterSocket(handleTableUpdated)

  const handleFreeTable = (table: ApiTable) => {
    setTable(table.id, table.number)
    setPanel('order')
  }

  const handleOccupiedTable = (table: ApiTable) => {
    setSelectedTable(table)
    setPanel('detail')
  }

  const handleOrderComplete = () => {
    setPanel('board')
    setSelectedTable(null)
    refresh()
  }

  const handleNewOrderFromDetail = () => {
    setPanel('order')
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Top bar */}
      <header className="bg-primary text-white px-5 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-xl font-bold">SAS Restaurantes</h1>
          <span className="text-white/60 text-sm font-body hidden sm:inline">Mesero</span>
        </div>

        <div className="flex items-center gap-3">
          {panel === 'board' && (
            <button
              type="button"
              onClick={() => { setDelivery(); setPanel('order') }}
              className="bg-secondary text-white text-sm font-semibold px-3 py-1.5 rounded-full hover:bg-secondary/90 transition-colors"
            >
              + Delivery
            </button>
          )}
          <span className="text-white/70 text-sm font-body hidden sm:inline">{user?.name}</span>
          <button
            type="button"
            onClick={logout}
            className="text-white/60 hover:text-white text-sm transition-colors"
            aria-label="Cerrar sesión"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {panel === 'board' && (
          <>
            <NotificationsPanel
              onServeItem={confirmItemServed}
              onNavigateToTable={handleNavigateToTable}
            />
            <TableBoard
              onSelectFreeTable={handleFreeTable}
              onSelectOccupiedTable={handleOccupiedTable}
              refreshSignal={refreshSignal}
            />
          </>
        )}

        {panel === 'detail' && selectedTable && (
          <TableDetail
            table={selectedTable}
            onClose={() => { setPanel('board'); refresh() }}
            onNewOrder={handleNewOrderFromDetail}
            onServeItem={confirmItemServed}
          />
        )}

        {panel === 'order' && (
          <div className="bg-white rounded-2xl shadow-sm border border-border p-5">
            <OrderFlow
              onComplete={handleOrderComplete}
              onCancel={() => { setPanel(selectedTable ? 'detail' : 'board') }}
            />
          </div>
        )}
      </main>
    </div>
  )
}