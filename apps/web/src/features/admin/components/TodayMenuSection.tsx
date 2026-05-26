import { useState } from 'react'
import { Card, Spinner, Badge } from '@sas/ui'
import { useAdminApi } from '../hooks/useAdminApi'
import type { DailyMenuItem } from '../types'

interface TodayMenuSectionProps {
  dailyMenu: DailyMenuItem[]
  loading: boolean
  onMenuChange: (updater: (prev: DailyMenuItem[]) => DailyMenuItem[]) => void
}

export function TodayMenuSection({ dailyMenu, loading, onMenuChange }: TodayMenuSectionProps) {
  const api = useAdminApi()
  const [toggling, setToggling] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(() =>
    dailyMenu.some((d) => d.confirmedAt !== null)
  )

  const isConfirmed = confirmed || dailyMenu.some((d) => d.confirmedAt !== null)

  const toggleAvailability = async (menuItemId: string, currentValue: boolean) => {
    setToggling((prev) => new Set(prev).add(menuItemId))

    // Optimistic update
    onMenuChange((prev) =>
      prev.map((d) =>
        d.menuItem.id === menuItemId
          ? { ...d, menuItem: { ...d.menuItem, isAvailable: !currentValue } }
          : d
      )
    )

    try {
      await api.patch(`/admin/menu-items/${menuItemId}/availability`, {
        isAvailable: !currentValue,
      })
    } catch {
      // Revert on error
      onMenuChange((prev) =>
        prev.map((d) =>
          d.menuItem.id === menuItemId
            ? { ...d, menuItem: { ...d.menuItem, isAvailable: currentValue } }
            : d
        )
      )
    } finally {
      setToggling((prev) => {
        const next = new Set(prev)
        next.delete(menuItemId)
        return next
      })
    }
  }

  const confirmMenu = async () => {
    setConfirming(true)
    try {
      await api.post('/admin/daily-menu/confirm')
      setConfirmed(true)
    } catch {
      // silent — user can retry
    } finally {
      setConfirming(false)
    }
  }

  const food = dailyMenu.filter((d) => d.menuItem.category.type === 'food')
  const drinks = dailyMenu.filter((d) => d.menuItem.category.type === 'drink')

  const headerRight = isConfirmed ? (
    <span className="text-xs font-medium text-state-ready bg-green-50 border border-state-ready/30 px-2 py-0.5 rounded-full">
      ✓ Confirmado
    </span>
  ) : null

  return (
    <Card
      header={
        <div className="flex items-center justify-between">
          <span className="font-semibold text-primary">🍽️ Menú de Hoy</span>
          {headerRight}
        </div>
      }
    >
      {loading && (
        <div className="flex justify-center py-10">
          <Spinner size="md" label="Cargando menú..." />
        </div>
      )}

      {!loading && dailyMenu.length === 0 && (
        <p className="text-sm text-muted text-center py-8">
          No hay menú programado para hoy. Configura el menú del día en el recetario.
        </p>
      )}

      {!loading && dailyMenu.length > 0 && (
        <div className="space-y-5">
          {food.length > 0 && (
            <MenuGroup
              label="Platos"
              entries={food}
              toggling={toggling}
              onToggle={toggleAvailability}
            />
          )}
          {drinks.length > 0 && (
            <MenuGroup
              label="Bebidas"
              entries={drinks}
              toggling={toggling}
              onToggle={toggleAvailability}
            />
          )}

          {!isConfirmed && (
            <div className="pt-3 border-t border-border">
              <button
                onClick={confirmMenu}
                disabled={confirming}
                className={[
                  'w-full py-2.5 rounded-lg text-sm font-semibold transition-colors',
                  'bg-secondary text-white hover:bg-secondary-hover',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50',
                ].join(' ')}
              >
                {confirming ? 'Confirmando...' : 'Confirmar menú del día'}
              </button>
              <p className="text-xs text-muted text-center mt-1.5">
                El mesero no puede tomar pedidos hasta confirmar.
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function MenuGroup({
  label,
  entries,
  toggling,
  onToggle,
}: {
  label: string
  entries: DailyMenuItem[]
  toggling: Set<string>
  onToggle: (menuItemId: string, current: boolean) => void
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-2">{label}</p>
      <ul className="space-y-1.5">
        {entries.map((entry) => (
          <MenuItemRow
            key={entry.id}
            entry={entry}
            isToggling={toggling.has(entry.menuItem.id)}
            onToggle={onToggle}
          />
        ))}
      </ul>
    </div>
  )
}

function MenuItemRow({
  entry,
  isToggling,
  onToggle,
}: {
  entry: DailyMenuItem
  isToggling: boolean
  onToggle: (menuItemId: string, current: boolean) => void
}) {
  const { menuItem } = entry
  const price = entry.overridePrice ?? menuItem.basePrice

  return (
    <li className="flex items-center justify-between gap-3 py-1">
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Checkbox toggle */}
        <button
          type="button"
          role="checkbox"
          aria-checked={menuItem.isAvailable}
          aria-label={`${menuItem.isAvailable ? 'Desactivar' : 'Activar'} ${menuItem.name}`}
          disabled={isToggling}
          onClick={() => onToggle(menuItem.id, menuItem.isAvailable)}
          className={[
            'w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors',
            menuItem.isAvailable
              ? 'bg-state-ready border-state-ready'
              : 'bg-white border-state-pending',
            isToggling ? 'opacity-40 cursor-wait' : 'cursor-pointer hover:opacity-80',
          ].join(' ')}
        >
          {menuItem.isAvailable && (
            <svg viewBox="0 0 10 10" fill="none" className="w-3 h-3" aria-hidden="true">
              <path
                d="M2 5l2.5 2.5 3.5-4"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>

        <span
          className={[
            'text-sm truncate',
            menuItem.isAvailable ? 'text-primary font-medium' : 'text-muted line-through',
          ].join(' ')}
        >
          {menuItem.name}
          {menuItem.isFeatured && (
            <span className="ml-1 text-accent" aria-label="Plato estrella">★</span>
          )}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {!menuItem.isAvailable && (
          <Badge variant="pending">Sin stock</Badge>
        )}
        <span className="font-mono text-sm text-muted tabular-nums">
          S/ {Number(price).toFixed(2)}
        </span>
      </div>
    </li>
  )
}
