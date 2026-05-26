import React from 'react'
import { Button } from '@sas/ui'
import { useCartStore } from '../store/cart.store'

interface OrderSummaryProps {
  onConfirm: () => void
  onBack: () => void
  loading?: boolean
}

export function OrderSummary({ onConfirm, onBack, loading }: OrderSummaryProps) {
  const { items, notes, setOrderNotes, tableNumber, type, isAdditional } = useCartStore()

  const foodItems = items.filter((i) => {
    // Classify by name heuristic (since we don't carry category type in cart)
    return true
  })

  const subtotal = items.reduce((acc, i) => acc + i.basePrice * i.quantity, 0)

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted font-body text-lg">No has agregado ningún ítem.</p>
        <Button variant="ghost" onClick={onBack} className="mt-4">
          Volver al menú
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Context */}
      <div className="flex items-center gap-2 text-sm font-body">
        <span className="bg-primary text-white px-2.5 py-0.5 rounded-full text-xs font-semibold">
          {type === 'delivery' ? 'Delivery' : `Mesa ${tableNumber}`}
        </span>
        {isAdditional && (
          <span className="bg-[#A05A2C] text-white px-2.5 py-0.5 rounded-full text-xs font-semibold">
            Adicional
          </span>
        )}
      </div>

      {/* Items */}
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.menuItemId} className="flex items-start justify-between gap-3 bg-white rounded-xl border border-border p-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-primary font-mono text-sm">×{item.quantity}</span>
                <span className="font-semibold text-primary font-body">{item.name}</span>
              </div>
              {item.notes && (
                <p className="text-xs text-accent mt-0.5">⚠ {item.notes}</p>
              )}
            </div>
            <span className="font-mono text-sm font-bold text-primary shrink-0">
              S/ {(item.basePrice * item.quantity).toFixed(2)}
            </span>
          </li>
        ))}
      </ul>

      {/* Notes */}
      <div>
        <label htmlFor="order-notes" className="block text-sm font-semibold text-primary mb-1.5">
          Nota general del pedido
        </label>
        <textarea
          id="order-notes"
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-primary font-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-secondary resize-none"
          rows={2}
          placeholder="Ej: cumpleaños, alergia a mariscos..."
          value={notes}
          onChange={(e) => setOrderNotes(e.target.value)}
        />
      </div>

      {/* Total */}
      <div className="bg-primary rounded-xl px-5 py-4 flex items-center justify-between">
        <span className="text-white font-display text-lg font-semibold">Total</span>
        <span className="text-white font-mono text-2xl font-bold">S/ {subtotal.toFixed(2)}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack} disabled={loading}>
          Atrás
        </Button>
        <Button variant="primary" size="lg" onClick={onConfirm} loading={loading} className="flex-1">
          {loading ? 'Creando pedido...' : 'Ir al pago →'}
        </Button>
      </div>
    </div>
  )
}