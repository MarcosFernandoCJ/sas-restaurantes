import React, { useEffect, useState } from 'react'
import { Spinner, Button } from '@sas/ui'
import type { ApiMenuItem } from '../types'
import { useApi } from '../hooks/useApi'
import { useCartStore } from '../store/cart.store'

interface MenuGridProps {
  type: 'food' | 'drink'
}

interface MenuItemCardProps {
  item: ApiMenuItem
  quantity: number
  onAdd: () => void
  onRemove: () => void
  onNoteChange: (notes: string) => void
  notes: string
}

function MenuItemCard({ item, quantity, onAdd, onRemove, onNoteChange, notes }: MenuItemCardProps) {
  const [showNote, setShowNote] = useState(false)

  return (
    <div className={[
      'bg-white rounded-xl border-2 p-4 transition-all',
      quantity > 0 ? 'border-secondary shadow-sm' : 'border-border',
    ].join(' ')}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-primary font-body leading-tight">
            {item.isFeatured && <span className="text-secondary mr-1">★</span>}
            {item.name}
          </p>
          {item.description && (
            <p className="text-xs text-muted mt-0.5 line-clamp-2">{item.description}</p>
          )}
        </div>
        <span className="font-mono text-sm font-bold text-primary shrink-0">
          S/ {Number(item.basePrice).toFixed(2)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 mt-3">
        {quantity > 0 ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onRemove}
              className="w-8 h-8 rounded-full bg-secondary text-white font-bold text-lg flex items-center justify-center hover:bg-secondary/90 transition-colors"
              aria-label={`Quitar ${item.name}`}
            >
              −
            </button>
            <span className="w-6 text-center font-bold text-primary font-mono">{quantity}</span>
            <button
              onClick={onAdd}
              className="w-8 h-8 rounded-full bg-secondary text-white font-bold text-lg flex items-center justify-center hover:bg-secondary/90 transition-colors"
              aria-label={`Agregar ${item.name}`}
            >
              +
            </button>
          </div>
        ) : (
          <button
            onClick={onAdd}
            className="flex-1 rounded-lg bg-primary text-white text-sm font-semibold py-2 px-3 hover:bg-primary/90 transition-colors active:scale-95"
            aria-label={`Agregar ${item.name}`}
          >
            Agregar
          </button>
        )}

        {quantity > 0 && (
          <button
            onClick={() => setShowNote((v) => !v)}
            className="text-xs text-muted underline"
            aria-label="Agregar nota"
          >
            {showNote ? 'Ocultar' : notes ? 'Nota ✓' : '+ Nota'}
          </button>
        )}
      </div>

      {showNote && quantity > 0 && (
        <textarea
          className="mt-2 w-full text-sm rounded-lg border border-border px-3 py-2 text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-secondary resize-none"
          rows={2}
          placeholder="Ej: sin cebolla, bien cocido..."
          value={notes}
          onChange={(e) => onNoteChange(e.target.value)}
        />
      )}
    </div>
  )
}

export function MenuGrid({ type }: MenuGridProps) {
  const { get } = useApi()
  const [items, setItems] = useState<ApiMenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { addItem, removeItem, updateQuantity, updateNotes, items: cartItems } = useCartStore()

  useEffect(() => {
    get<ApiMenuItem[]>(`/menu-items?type=${type}&available=true`)
      .then(setItems)
      .catch(() => setError('No se pudo cargar el menú'))
      .finally(() => setLoading(false))
  }, [type]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="flex justify-center py-10"><Spinner size="md" label="Cargando menú..." /></div>
  if (error) return <p className="text-center text-red-600 py-10">{error}</p>
  if (items.length === 0) return <p className="text-center text-muted py-10">No hay {type === 'food' ? 'platos' : 'bebidas'} disponibles hoy.</p>

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((item) => {
        const cartItem = cartItems.find((ci) => ci.menuItemId === item.id)
        const qty = cartItem?.quantity ?? 0
        return (
          <MenuItemCard
            key={item.id}
            item={item}
            quantity={qty}
            onAdd={() => addItem({ menuItemId: item.id, name: item.name, basePrice: Number(item.basePrice) })}
            onRemove={() => updateQuantity(item.id, qty - 1)}
            onNoteChange={(notes) => updateNotes(item.id, notes)}
            notes={cartItem?.notes ?? ''}
          />
        )
      })}
    </div>
  )
}