import React, { useCallback } from 'react'
import { KitchenCard } from '@/features/kitchen/components/KitchenCard'
import { useKitchenSocket } from '@/features/kitchen/hooks/useKitchenSocket'
import { useWakeLock } from '@/features/kitchen/hooks/useWakeLock'
import { useKitchenStore } from '@/features/kitchen/store/kitchen.store'

export function KitchenPage() {
  useWakeLock()

  const { claimItemAction, markItemReadyAction } = useKitchenSocket()
  const { orders, updateItemStatus, clearItemUpdated } = useKitchenStore()

  // FIFO: regular orders ASC by createdAt, additional orders always last
  const sortedOrders = [...orders]
    .filter((o) => !o.items.every((i) => i.status === 'served'))
    .sort((a, b) => {
      if (a.isAdditional !== b.isAdditional) return a.isAdditional ? 1 : -1
      return a.createdAt.getTime() - b.createdAt.getTime()
    })

  const handleClaimItem = useCallback(
    (itemId: string) => {
      claimItemAction(itemId)
      // Optimistic update while waiting for server echo
      for (const order of orders) {
        if (order.items.some((i) => i.id === itemId)) {
          updateItemStatus(order.id, itemId, 'in_prep')
          break
        }
      }
    },
    [claimItemAction, orders, updateItemStatus]
  )

  const handleMarkItemReady = useCallback(
    (itemId: string) => {
      markItemReadyAction(itemId)
      for (const order of orders) {
        if (order.items.some((i) => i.id === itemId)) {
          updateItemStatus(order.id, itemId, 'ready')
          break
        }
      }
    },
    [markItemReadyAction, orders, updateItemStatus]
  )

  return (
    <div data-theme="dark" className="min-h-screen bg-[#0F1A24] py-6 px-4">
      {/* Top bar */}
      <header className="flex items-center justify-between mb-6 max-w-[1600px] mx-auto">
        <h1 className="font-display text-2xl font-bold text-[#B0C4D8]">
          Cocina SAS
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#8C9BAA] font-mono">
            {sortedOrders.length}{' '}
            {sortedOrders.length === 1 ? 'pedido activo' : 'pedidos activos'}
          </span>
          {/* Live indicator */}
          <span
            className="w-2.5 h-2.5 rounded-full bg-[#1A6B3C] animate-pulse"
            aria-label="Conexión activa"
            role="status"
          />
        </div>
      </header>

      {/* Queue */}
      {sortedOrders.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-4"
          style={{ minHeight: 'calc(100vh - 120px)' }}
        >
          <span className="text-7xl select-none" aria-hidden="true">
            🍳
          </span>
          <p className="text-[#8C9BAA] text-xl font-body">
            Sin pedidos en cola
          </p>
        </div>
      ) : (
        <div className="max-w-[1600px] mx-auto grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedOrders.map((order) => (
            <KitchenCard
              key={order.id}
              order={order}
              onClaimItem={handleClaimItem}
              onMarkItemReady={handleMarkItemReady}
              onClearUpdate={clearItemUpdated}
            />
          ))}
        </div>
      )}
    </div>
  )
}