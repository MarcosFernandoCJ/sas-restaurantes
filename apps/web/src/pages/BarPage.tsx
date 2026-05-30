import { useCallback, useEffect, useState } from 'react'
import { BarCard } from '@/features/bar/components/BarCard'
import { useBarSocket } from '@/features/bar/hooks/useBarSocket'
import { useBarStore } from '@/features/bar/store/bar.store'
import type { BarOrder } from '@/features/bar/types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

// ─── Gate screens ─────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0F1A24] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-[#B0C4D8] border-t-transparent animate-spin" />
        <p className="text-[#8C9BAA] font-body text-sm">Verificando jornada…</p>
      </div>
    </div>
  )
}

function ClosedScreen() {
  return (
    <div className="min-h-screen bg-[#0F1A24] flex flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="text-8xl select-none" aria-hidden="true">🔒</span>
      <div>
        <h1 className="font-display text-3xl font-bold text-[#B0C4D8] mb-3">
          Jornada no iniciada
        </h1>
        <p className="text-[#8C9BAA] font-body text-base max-w-sm mx-auto leading-relaxed">
          El bar estará disponible cuando el administrador inicie operaciones.
        </p>
      </div>
    </div>
  )
}

// ─── Shift bar ────────────────────────────────────────────────────────────────

function ShiftBar({ startedAt }: { startedAt: string | null }) {
  const label = startedAt
    ? new Date(startedAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
    : null
  return (
    <span className="flex items-center gap-2 text-sm text-[#1A6B3C] bg-[#1A6B3C]/10 px-3 py-1.5 rounded-lg border border-[#1A6B3C]/30">
      <span className="w-2 h-2 rounded-full bg-[#1A6B3C] animate-pulse" />
      Jornada desde {label ?? '—'}
    </span>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hasActiveItems(order: BarOrder): boolean {
  return order.items.some((i) => i.status === 'pending' || i.status === 'in_prep')
}

function allItemsReady(order: BarOrder): boolean {
  return order.items.length > 0 && order.items.every((i) => i.status === 'ready' || i.status === 'served')
}

function sortOrders(orders: BarOrder[]): BarOrder[] {
  return [...orders].sort((a, b) => {
    if (a.isAdditional !== b.isAdditional) return a.isAdditional ? 1 : -1
    return a.createdAt.getTime() - b.createdAt.getTime()
  })
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function BarPage() {
  const { claimItemAction, markItemReadyAction } = useBarSocket()
  const { orders, removingOrderIds, clearItemUpdated, setJourney, journey } = useBarStore()

  const [journeyLoading, setJourneyLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/journey/current`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { id: string; startedAt: string } | null) => {
        if (data?.id) {
          setJourney({ sessionId: data.id, isOpen: true, startedAt: data.startedAt })
        } else {
          setJourney({ sessionId: null, isOpen: false, startedAt: null })
        }
      })
      .catch(() => {
        setJourney({ sessionId: null, isOpen: false, startedAt: null })
      })
      .finally(() => setJourneyLoading(false))
  }, [setJourney])

  const handleClaimItem = useCallback(
    (itemId: string) => {
      claimItemAction(itemId)
      const { claimItem, orders: current } = useBarStore.getState()
      for (const order of current) {
        if (order.items.some((i) => i.id === itemId)) {
          claimItem(order.id, itemId, null)
          break
        }
      }
    },
    [claimItemAction]
  )

  const handleMarkItemReady = useCallback(
    (itemId: string) => {
      markItemReadyAction(itemId)
      const { markItemReady, orders: current } = useBarStore.getState()
      for (const order of current) {
        if (order.items.some((i) => i.id === itemId)) {
          markItemReady(order.id, itemId)
          break
        }
      }
    },
    [markItemReadyAction]
  )

  if (journeyLoading) return <LoadingScreen />
  if (!journey.isOpen) return <ClosedScreen />

  const activeOrders = sortOrders(orders.filter(hasActiveItems))
  const readyOrders = sortOrders(orders.filter(allItemsReady))
  const totalActive = activeOrders.length + readyOrders.length

  return (
    <div data-theme="dark" className="min-h-screen bg-[#0F1A24] py-6 px-4">
      <header className="flex items-center justify-between mb-6 max-w-[1600px] mx-auto gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-2xl font-bold text-[#B0C4D8]">Bar SAS</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#8C9BAA] font-mono">
              {totalActive} {totalActive === 1 ? 'pedido' : 'pedidos'}
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#1A6B3C] animate-pulse" />
          </div>
        </div>
        <ShiftBar startedAt={journey.startedAt} />
      </header>

      {activeOrders.length === 0 && readyOrders.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-4"
          style={{ minHeight: 'calc(100vh - 120px)' }}
        >
          <span className="text-7xl select-none" aria-hidden="true">🍹</span>
          <p className="text-[#8C9BAA] text-xl font-body">Sin bebidas en cola</p>
        </div>
      ) : (
        <div className="max-w-[1600px] mx-auto space-y-8">
          {activeOrders.length > 0 && (
            <section aria-label="Bebidas en preparación">
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {activeOrders.map((order) => (
                  <BarCard
                    key={order.id}
                    order={order}
                    isRemoving={removingOrderIds.includes(order.id)}
                    onClaimItem={handleClaimItem}
                    onMarkItemReady={handleMarkItemReady}
                    onClearUpdate={clearItemUpdated}
                  />
                ))}
              </div>
            </section>
          )}

          {readyOrders.length > 0 && (
            <section aria-label="Bebidas listas esperando mesero">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-bold text-[#1A6B3C] uppercase tracking-widest">
                  Listas · esperando al mesero
                </span>
                <div className="flex-1 h-px bg-[#1A6B3C]/20" />
                <span className="text-xs text-[#1A6B3C] font-mono">{readyOrders.length}</span>
              </div>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {readyOrders.map((order) => (
                  <BarCard
                    key={order.id}
                    order={order}
                    isCompactMode
                    isRemoving={removingOrderIds.includes(order.id)}
                    onClaimItem={handleClaimItem}
                    onMarkItemReady={handleMarkItemReady}
                    onClearUpdate={clearItemUpdated}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
