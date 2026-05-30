import { useState, useCallback, useEffect, useRef } from 'react'
import { TableBoard } from '@/features/waiter/components/TableBoard'
import { TableDetail } from '@/features/waiter/components/TableDetail'
import { OrderFlow } from '@/features/waiter/components/OrderFlow'
import { NotificationsPanel } from '@/features/waiter/components/NotificationsPanel'
import { PaymentModal } from '@/features/waiter/components/PaymentModal'
import { ToastOverlay } from '@/features/waiter/components/ToastOverlay'
import { useWaiterAuthStore } from '@/features/waiter/store/waiter-auth.store'
import { useCartStore } from '@/features/waiter/store/cart.store'
import { useWaiterSocket } from '@/features/waiter/hooks/useWaiterSocket'
import { useWaiterJourneyStore } from '@/features/waiter/store/journey.store'
import { useNotificationsStore } from '@/features/waiter/store/notifications.store'
import type { ApiTable, ItemReadyNotification } from '@/features/waiter/types'

type Panel = 'board' | 'detail' | 'order'

// ─── Gate screens ─────────────────────────────────────────────────────────────

function ClosedScreen() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="text-7xl select-none" aria-hidden="true">🔒</span>
      <div>
        <h1 className="font-display text-2xl font-bold text-primary mb-2">Jornada no iniciada</h1>
        <p className="text-muted font-body text-base max-w-xs mx-auto leading-relaxed">
          El local está cerrado. Espera a que el administrador inicie operaciones del día.
        </p>
      </div>
      <span className="flex items-center gap-2 text-sm text-muted bg-white border border-border px-4 py-2 rounded-full">
        <span className="w-2 h-2 rounded-full bg-muted/50" />
        Esperando apertura de jornada
      </span>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      <p className="text-muted font-body text-sm">Verificando estado del local…</p>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function WaiterPage() {
  const user = useWaiterAuthStore((s) => s.user)
  const logout = useWaiterAuthStore((s) => s.logout)
  const { setTable, setAdditional, setDelivery } = useCartStore()
  const { isOpen } = useWaiterJourneyStore()
  const notifications = useNotificationsStore((s) => s.notifications)

  const [panel, setPanel] = useState<Panel>('board')
  const [selectedTable, setSelectedTable] = useState<ApiTable | null>(null)
  const [refreshSignal, setRefreshSignal] = useState(0)

  const [activeToast, setActiveToast] = useState<ItemReadyNotification | null>(null)
  const lastNotifCount = useRef(0)
  useEffect(() => {
    if (notifications.length > lastNotifCount.current) {
      setActiveToast(notifications[0])
    }
    lastNotifCount.current = notifications.length
  }, [notifications])

  const [payTarget, setPayTarget] = useState<{ orderId: string; invoiceId: string; total: number } | null>(null)

  const refresh = useCallback(() => setRefreshSignal((n) => n + 1), [])

  const handleTableUpdated = useCallback(({ tableId }: { tableId: string; orderId: string }) => {
    refresh()
    if (selectedTable?.id === tableId && panel === 'detail') {
      setRefreshSignal((n) => n + 1)
    }
  }, [selectedTable, panel, refresh])

  const { confirmItemServed } = useWaiterSocket(handleTableUpdated)

  // Gate — must be before any non-hook code that depends on session
  if (isOpen === null) return <LoadingScreen />
  if (!isOpen) return <ClosedScreen />

  // ─── Table action handlers ────────────────────────────────────────────────

  const handleSelectTable = (table: ApiTable) => {
    if (table.orders.length === 0) {
      // Free table → start new order
      setTable(table.id, table.number)
      setPanel('order')
    } else {
      setSelectedTable(table)
      setPanel('detail')
    }
  }

  const handleAddToTable = (table: ApiTable) => {
    const activeOrder = table.orders[0]
    setTable(table.id, table.number)
    if (activeOrder) setAdditional(activeOrder.id)
    setPanel('order')
  }

  const handlePayTable = (table: ApiTable) => {
    const orderWithPending = table.orders.find((o) => o.invoice?.status === 'pending')
    if (orderWithPending?.invoice) {
      setPayTarget({
        orderId: orderWithPending.id,
        invoiceId: orderWithPending.invoice.id,
        total: Number(orderWithPending.invoice.total),
      })
    }
  }

  const handleServeTable = (table: ApiTable) => {
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

  const handlePay = (orderId: string, invoiceId: string, total: number) => {
    setPayTarget({ orderId, invoiceId, total })
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Floating toast notification */}
      {activeToast && (
        <ToastOverlay
          notification={activeToast}
          onDismiss={() => setActiveToast(null)}
        />
      )}

      {/* Pay modal (from card or from detail) */}
      {payTarget && (
        <PaymentModal
          orderId={payTarget.orderId}
          invoiceId={payTarget.invoiceId}
          total={payTarget.total}
          onSuccess={() => { setPayTarget(null); refresh() }}
          onCancel={() => setPayTarget(null)}
        />
      )}

      {/* Top bar */}
      <header className="bg-primary text-white px-5 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-xl font-bold">SAS Restaurantes</h1>
          <span className="text-white/60 text-sm font-body hidden sm:inline">Mesero</span>
          <span className="flex items-center gap-1 text-xs text-[#1A6B3C] bg-[#1A6B3C]/20 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1A6B3C] animate-pulse" />
            Jornada activa
          </span>
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
              onNavigateToTable={(_tableId) => { setPanel('board'); refresh() }}
            />
            <TableBoard
              onSelectTable={handleSelectTable}
              onAddToTable={handleAddToTable}
              onPayTable={handlePayTable}
              onServeTable={handleServeTable}
              refreshSignal={refreshSignal}
              currentUserId={user?.id ?? undefined}
            />
          </>
        )}

        {panel === 'detail' && selectedTable && (
          <TableDetail
            table={selectedTable}
            refreshSignal={refreshSignal}
            onClose={() => { setPanel('board'); refresh() }}
            onNewOrder={handleNewOrderFromDetail}
            onServeItem={confirmItemServed}
            onPay={handlePay}
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
