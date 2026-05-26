import { useState, useEffect, useMemo } from 'react'
import { Card, Button, Badge, Spinner } from '@sas/ui'
import type { BadgeVariant } from '@sas/ui'
import { useAdminApi } from '../hooks/useAdminApi'
import type { MenuItem, MenuCategory, Ingredient, RecipeLine, RecetarioFilter } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeRecipeCost(recipes: RecipeLine[]): number {
  return recipes.reduce(
    (sum, r) => sum + r.quantityNeeded * r.ingredient.unitCost,
    0
  )
}

function tempId(): string {
  return `tmp-${Date.now()}-${Math.floor(Math.random() * 10000)}`
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecipeLineForm {
  tempId: string
  ingredientId: string
  quantityNeeded: string
  notes: string
}

interface MenuItemFormState {
  name: string
  description: string
  categoryId: string
  basePrice: string
  prepTimeMinutes: string
  isFeatured: boolean
  isAvailable: boolean
  imageUrl: string
  isDirectIngredient: boolean
  recipes: RecipeLineForm[]
}

const EMPTY_FORM: MenuItemFormState = {
  name: '',
  description: '',
  categoryId: '',
  basePrice: '0',
  prepTimeMinutes: '5',
  isFeatured: false,
  isAvailable: true,
  imageUrl: '',
  isDirectIngredient: false,
  recipes: [],
}

const TYPE_CONFIG: Record<string, { variant: BadgeVariant; label: string }> = {
  food:  { variant: 'in_prep', label: 'Plato' },
  drink: { variant: 'pending', label: 'Bebida' },
  other: { variant: 'default', label: 'Otro' },
}

const inputCls =
  'w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40'

// ─── Menu Item Card ───────────────────────────────────────────────────────────

function MenuItemCard({
  item,
  onDetail,
  onEdit,
  onDeactivate,
}: {
  item: MenuItem
  onDetail: (item: MenuItem) => void
  onEdit: (item: MenuItem) => void
  onDeactivate: (item: MenuItem) => void
}) {
  const cost = computeRecipeCost(item.recipes)
  const typeCfg = TYPE_CONFIG[item.category.type] ?? TYPE_CONFIG.other

  return (
    <article className="bg-white rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
      {/* Image */}
      <div className="relative h-40 bg-surface flex items-center justify-center">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-5xl" aria-hidden="true">
            {item.category.type === 'drink' ? '🥤' : '🍽️'}
          </span>
        )}
        {item.isFeatured && (
          <span
            className="absolute top-2 right-2 bg-accent text-primary text-xs font-bold px-2 py-0.5 rounded-full"
            title="Plato estrella"
          >
            ★ Estrella
          </span>
        )}
        {!item.isAvailable && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white text-xs font-semibold bg-black/60 px-2 py-1 rounded">
              No disponible
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 gap-3">
        <div>
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-primary leading-tight">{item.name}</h3>
            <Badge variant={typeCfg.variant}>{typeCfg.label}</Badge>
          </div>
          {item.isDirectIngredient && (
            <p className="text-xs text-muted italic">Insumo directo · Sin receta</p>
          )}
          {!item.isDirectIngredient && (
            <p className="text-xs font-mono text-muted">
              Costo receta:{' '}
              <span className="text-primary font-semibold">
                S/ {cost.toFixed(2)}
              </span>
              {item.basePrice > 0 && (
                <span className="ml-1 text-state-ready">
                  ({((item.basePrice - cost) / Math.max(item.basePrice, 0.01) * 100).toFixed(0)}% margen)
                </span>
              )}
            </p>
          )}
        </div>

        <p className="text-xs text-muted font-mono">
          Precio: S/ {item.basePrice.toFixed(2)} · {item.prepTimeMinutes} min
        </p>

        <div className="flex gap-2 mt-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDetail(item)}
            className="flex-1"
          >
            Ver detalle
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onEdit(item)}
            className="flex-1"
          >
            Editar
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onDeactivate(item)}
            aria-label={`Desactivar ${item.name}`}
          >
            ✕
          </Button>
        </div>
      </div>
    </article>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const cost = computeRecipeCost(item.recipes)
  const typeCfg = TYPE_CONFIG[item.category.type] ?? TYPE_CONFIG.other

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[85vh] overflow-y-auto">
        {/* Header image */}
        <div className="relative h-48 bg-surface flex items-center justify-center">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-full object-cover rounded-t-xl"
            />
          ) : (
            <span className="text-7xl" aria-hidden="true">
              {item.category.type === 'drink' ? '🥤' : '🍽️'}
            </span>
          )}
          <button
            onClick={onClose}
            aria-label="Cerrar detalle"
            className="absolute top-3 right-3 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/70 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Title row */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="detail-title" className="font-display text-xl font-bold text-primary">
                {item.name}
              </h2>
              <p className="text-sm text-muted mt-0.5">{item.category.name}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge variant={typeCfg.variant}>{typeCfg.label}</Badge>
              {item.isFeatured && (
                <span className="text-xs text-accent font-semibold">★ Plato estrella</span>
              )}
            </div>
          </div>

          {item.description && (
            <p className="text-sm text-muted">{item.description}</p>
          )}

          {/* Pricing */}
          <div className="grid grid-cols-3 gap-3 bg-surface rounded-lg p-3 text-center">
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">Precio venta</p>
              <p className="font-display font-bold text-primary">S/ {item.basePrice.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">Costo receta</p>
              <p className="font-display font-bold text-primary">S/ {cost.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">Margen</p>
              <p
                className={[
                  'font-display font-bold',
                  item.basePrice > cost ? 'text-state-ready' : 'text-secondary',
                ].join(' ')}
              >
                {item.basePrice > 0
                  ? `${(((item.basePrice - cost) / item.basePrice) * 100).toFixed(1)}%`
                  : '—'}
              </p>
            </div>
          </div>

          {/* Recipes */}
          {item.isDirectIngredient ? (
            <div className="bg-blue-50 rounded-lg p-3 text-sm text-primary">
              <p className="font-semibold">Insumo directo</p>
              <p className="text-muted mt-0.5">
                Este ítem se despacha directamente sin preparación (ej: gaseosa, agua).
              </p>
            </div>
          ) : item.recipes.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">Sin receta registrada.</p>
          ) : (
            <div>
              <h3 className="text-sm font-semibold text-primary mb-2">Ingredientes de la receta</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[380px]">
                  <thead>
                    <tr className="border-b border-border">
                      {['Insumo', 'Cantidad', 'Costo', 'Notas'].map((col, i) => (
                        <th
                          key={col}
                          scope="col"
                          className={[
                            'py-1.5 text-xs font-semibold uppercase tracking-wide text-muted',
                            i === 0 ? 'text-left pr-3' : i === 3 ? 'text-left px-3' : 'text-right px-3',
                          ].join(' ')}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {item.recipes.map((r) => (
                      <tr key={r.id} className="border-b border-border/50">
                        <td className="py-2 pr-3 font-medium text-primary">{r.ingredient.name}</td>
                        <td className="py-2 px-3 text-right font-mono text-muted tabular-nums">
                          {r.quantityNeeded.toFixed(3)} {r.ingredient.unit}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-muted tabular-nums">
                          S/ {(r.quantityNeeded * r.ingredient.unitCost).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-muted text-xs">{r.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2} className="pt-3 text-right font-semibold text-primary text-xs uppercase tracking-wide">
                        Total receta
                      </td>
                      <td className="pt-3 px-3 text-right font-mono font-bold text-primary tabular-nums">
                        S/ {cost.toFixed(2)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Prep time */}
          <p className="text-xs text-muted">
            Tiempo de preparación: <span className="font-semibold text-primary">{item.prepTimeMinutes} min</span>
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Menu Item Form Modal ─────────────────────────────────────────────────────

function MenuItemFormModal({
  menuItem,
  categories,
  allIngredients,
  onSave,
  onClose,
}: {
  menuItem: MenuItem | null
  categories: MenuCategory[]
  allIngredients: Ingredient[]
  onSave: (data: MenuItemFormState) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<MenuItemFormState>(() => {
    if (!menuItem) return EMPTY_FORM
    return {
      name: menuItem.name,
      description: menuItem.description ?? '',
      categoryId: menuItem.categoryId,
      basePrice: String(menuItem.basePrice),
      prepTimeMinutes: String(menuItem.prepTimeMinutes),
      isFeatured: menuItem.isFeatured,
      isAvailable: menuItem.isAvailable,
      imageUrl: menuItem.imageUrl ?? '',
      isDirectIngredient: menuItem.isDirectIngredient,
      recipes: menuItem.recipes.map((r) => ({
        tempId: r.id,
        ingredientId: r.ingredientId,
        quantityNeeded: String(r.quantityNeeded),
        notes: r.notes ?? '',
      })),
    }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setField = <K extends keyof MenuItemFormState>(
    field: K,
    value: MenuItemFormState[K]
  ) => setForm((prev) => ({ ...prev, [field]: value }))

  // ── Recipe line helpers ──────────────────────────────────────────────────

  const addLine = () =>
    setField('recipes', [
      ...form.recipes,
      { tempId: tempId(), ingredientId: '', quantityNeeded: '1', notes: '' },
    ])

  const removeLine = (tid: string) =>
    setField(
      'recipes',
      form.recipes.filter((r) => r.tempId !== tid)
    )

  const updateLine = (tid: string, field: keyof RecipeLineForm, value: string) =>
    setField(
      'recipes',
      form.recipes.map((r) => (r.tempId === tid ? { ...r, [field]: value } : r))
    )

  // ── Live cost computation ────────────────────────────────────────────────

  const liveCost = form.isDirectIngredient
    ? 0
    : form.recipes.reduce((sum, line) => {
        const ing = allIngredients.find((i) => i.id === line.ingredientId)
        const qty = parseFloat(line.quantityNeeded) || 0
        return sum + qty * (ing?.unitCost ?? 0)
      }, 0)

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('El nombre es requerido'); return }
    if (!form.categoryId) { setError('Selecciona una categoría'); return }
    setSaving(true)
    setError(null)
    try {
      await onSave(form)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mi-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <h2 id="mi-form-title" className="font-display text-lg font-bold text-primary">
            {menuItem ? 'Editar ítem del menú' : 'Nuevo ítem del menú'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar formulario"
            className="text-muted hover:text-primary text-2xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="mi-name" className="block text-sm font-medium text-primary mb-1">
                Nombre *
              </label>
              <input
                id="mi-name"
                type="text"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                className={inputCls}
                placeholder="Ej: Pollo a la brasa 1/4"
                required
                autoFocus
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="mi-desc" className="block text-sm font-medium text-primary mb-1">
                Descripción
              </label>
              <textarea
                id="mi-desc"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                rows={2}
                className={`${inputCls} resize-none`}
                placeholder="Descripción del plato (opcional)"
              />
            </div>

            <div>
              <label htmlFor="mi-cat" className="block text-sm font-medium text-primary mb-1">
                Categoría *
              </label>
              <select
                id="mi-cat"
                value={form.categoryId}
                onChange={(e) => setField('categoryId', e.target.value)}
                className={inputCls}
                required
              >
                <option value="">Selecciona categoría...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="mi-price" className="block text-sm font-medium text-primary mb-1">
                Precio de venta (S/)
              </label>
              <input
                id="mi-price"
                type="number"
                min="0"
                step="0.01"
                value={form.basePrice}
                onChange={(e) => setField('basePrice', e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="mi-prep" className="block text-sm font-medium text-primary mb-1">
                Tiempo de prep. (min)
              </label>
              <input
                id="mi-prep"
                type="number"
                min="0"
                step="1"
                value={form.prepTimeMinutes}
                onChange={(e) => setField('prepTimeMinutes', e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="mi-img" className="block text-sm font-medium text-primary mb-1">
                URL de imagen
              </label>
              <input
                id="mi-img"
                type="url"
                value={form.imageUrl}
                onChange={(e) => setField('imageUrl', e.target.value)}
                className={inputCls}
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => setField('isFeatured', e.target.checked)}
                className="w-4 h-4 accent-secondary"
              />
              <span className="text-sm text-primary">★ Plato estrella</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isAvailable}
                onChange={(e) => setField('isAvailable', e.target.checked)}
                className="w-4 h-4 accent-secondary"
              />
              <span className="text-sm text-primary">Disponible para tomar pedidos</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isDirectIngredient}
                onChange={(e) => setField('isDirectIngredient', e.target.checked)}
                className="w-4 h-4 accent-secondary"
              />
              <span className="text-sm text-primary">
                Insumo directo{' '}
                <span className="text-muted">(sin preparación — ej: gaseosa, agua)</span>
              </span>
            </label>
          </div>

          {/* Recipe editor */}
          {!form.isDirectIngredient && (
            <div className="border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-primary">Receta</h3>
                  <p className="text-xs text-muted mt-0.5">
                    Costo calculado:{' '}
                    <span className="font-mono font-semibold text-primary">
                      S/ {liveCost.toFixed(2)}
                    </span>
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={addLine}>
                  + Agregar ingrediente
                </Button>
              </div>

              {form.recipes.length === 0 ? (
                <p className="text-xs text-muted text-center py-4">
                  Aún no hay ingredientes en la receta.
                </p>
              ) : (
                <div className="space-y-2">
                  {form.recipes.map((line) => {
                    const ing = allIngredients.find((i) => i.id === line.ingredientId)
                    return (
                      <div
                        key={line.tempId}
                        className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center"
                      >
                        {/* Ingredient selector */}
                        <select
                          value={line.ingredientId}
                          onChange={(e) =>
                            updateLine(line.tempId, 'ingredientId', e.target.value)
                          }
                          className={inputCls}
                          aria-label="Seleccionar ingrediente"
                        >
                          <option value="">Selecciona...</option>
                          {allIngredients.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} ({i.unit})
                            </option>
                          ))}
                        </select>

                        {/* Quantity */}
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={line.quantityNeeded}
                            onChange={(e) =>
                              updateLine(line.tempId, 'quantityNeeded', e.target.value)
                            }
                            className="w-24 border border-border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40 text-right font-mono"
                            aria-label="Cantidad necesaria"
                          />
                          <span className="text-xs text-muted whitespace-nowrap">
                            {ing?.unit ?? '—'}
                          </span>
                        </div>

                        {/* Notes */}
                        <input
                          type="text"
                          value={line.notes}
                          onChange={(e) =>
                            updateLine(line.tempId, 'notes', e.target.value)
                          }
                          className={inputCls}
                          placeholder="Notas (opcional)"
                          aria-label="Notas para este ingrediente"
                        />

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => removeLine(line.tempId)}
                          aria-label="Eliminar ingrediente de receta"
                          className="text-muted hover:text-secondary transition-colors text-xl leading-none px-1"
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={saving}>
              {menuItem ? 'Guardar cambios' : 'Crear ítem'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Confirm Deactivate Dialog ────────────────────────────────────────────────

function ConfirmDeactivate({
  itemName,
  onConfirm,
  onCancel,
  loading,
}: {
  itemName: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
        <h2 className="font-display text-base font-bold text-primary">¿Desactivar ítem del menú?</h2>
        <p className="text-sm text-muted">
          El ítem{' '}
          <span className="font-semibold text-primary">"{itemName}"</span> quedará inactivo y no
          aparecerá en el menú ni en el recetario. No se perderán los datos históricos.
        </p>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" variant="danger" size="sm" onClick={onConfirm} loading={loading}>
            Desactivar
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

function FilterBar({
  filter,
  search,
  onFilter,
  onSearch,
}: {
  filter: RecetarioFilter
  search: string
  onFilter: (f: RecetarioFilter) => void
  onSearch: (s: string) => void
}) {
  const tabs: { value: RecetarioFilter; label: string }[] = [
    { value: 'all',   label: 'Todos' },
    { value: 'food',  label: 'Platos' },
    { value: 'drink', label: 'Bebidas' },
  ]

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
      <nav className="flex gap-1 bg-surface rounded-lg p-1" aria-label="Filtrar por tipo">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onFilter(tab.value)}
            aria-current={filter === tab.value ? 'page' : undefined}
            className={[
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              filter === tab.value
                ? 'bg-white text-primary shadow-sm'
                : 'text-muted hover:text-primary',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <input
        type="search"
        placeholder="Buscar plato o bebida..."
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40 w-full sm:w-64"
        aria-label="Buscar en el recetario"
      />
    </div>
  )
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export function RecetarioTab() {
  const api = useAdminApi()

  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filter, setFilter] = useState<RecetarioFilter>('all')
  const [search, setSearch] = useState('')

  // Modals
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [showDeactivate, setShowDeactivate] = useState(false)
  const [deactivatingItem, setDeactivatingItem] = useState<MenuItem | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  // ── Fetch on mount ────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      api.get<MenuItem[]>('/admin/menu-items'),
      api.get<MenuCategory[]>('/admin/menu-categories'),
      api.get<Ingredient[]>('/admin/ingredients'),
    ])
      .then(([items, cats, ings]) => {
        setMenuItems(items)
        setCategories(cats)
        setAllIngredients(ings)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = menuItems
    if (filter !== 'all') {
      list = list.filter((m) => m.category.type === filter)
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.category.name.toLowerCase().includes(q)
      )
    }
    return list
  }, [menuItems, filter, search])

  // ── CRUD handlers ─────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingItem(null)
    setShowForm(true)
  }

  const openEdit = (item: MenuItem) => {
    setSelectedItem(null)
    setEditingItem(item)
    setShowForm(true)
  }

  const openDeactivate = (item: MenuItem) => {
    setSelectedItem(null)
    setDeactivatingItem(item)
    setShowDeactivate(true)
  }

  const handleSave = async (data: MenuItemFormState): Promise<void> => {
    const body = {
      name: data.name.trim(),
      description: data.description.trim() || null,
      categoryId: data.categoryId,
      basePrice: parseFloat(data.basePrice) || 0,
      prepTimeMinutes: parseInt(data.prepTimeMinutes, 10) || 0,
      isFeatured: data.isFeatured,
      isAvailable: data.isAvailable,
      imageUrl: data.imageUrl.trim() || null,
      isDirectIngredient: data.isDirectIngredient,
      recipes: data.isDirectIngredient
        ? []
        : data.recipes
            .filter((r) => r.ingredientId)
            .map((r) => ({
              ingredientId: r.ingredientId,
              quantityNeeded: parseFloat(r.quantityNeeded) || 0,
              notes: r.notes.trim() || null,
            })),
    }

    if (editingItem) {
      const updated = await api.patch<MenuItem>(`/admin/menu-items/${editingItem.id}`, body)
      setMenuItems((prev) =>
        prev.map((m) => (m.id === editingItem.id ? updated : m))
      )
    } else {
      const created = await api.post<MenuItem>('/admin/menu-items', body)
      setMenuItems((prev) => [...prev, created])
    }

    setShowForm(false)
  }

  const handleDeactivate = async () => {
    if (!deactivatingItem) return
    setDeactivating(true)
    try {
      await api.patch(`/admin/menu-items/${deactivatingItem.id}`, { isActive: false })
      setMenuItems((prev) => prev.filter((m) => m.id !== deactivatingItem.id))
      setShowDeactivate(false)
      setDeactivatingItem(null)
    } catch {
      // keep dialog open
    } finally {
      setDeactivating(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Modals */}
      {selectedItem && (
        <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
      {showForm && (
        <MenuItemFormModal
          menuItem={editingItem}
          categories={categories}
          allIngredients={allIngredients}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
        />
      )}
      {showDeactivate && deactivatingItem && (
        <ConfirmDeactivate
          itemName={deactivatingItem.name}
          onConfirm={handleDeactivate}
          onCancel={() => setShowDeactivate(false)}
          loading={deactivating}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" label="Cargando recetario..." />
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-display text-xl font-bold text-primary">📋 Recetario</h2>
              <p className="text-sm text-muted mt-0.5">
                {menuItems.length} ítems ·{' '}
                {menuItems.filter((m) => m.category.type === 'food').length} platos ·{' '}
                {menuItems.filter((m) => m.category.type === 'drink').length} bebidas
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={openCreate}>
              + Nuevo ítem
            </Button>
          </div>

          {/* Filter bar */}
          <FilterBar
            filter={filter}
            search={search}
            onFilter={(f) => setFilter(f)}
            onSearch={(s) => setSearch(s)}
          />

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-muted">
              <p className="text-4xl mb-3" aria-hidden="true">🍽️</p>
              <p className="text-sm">
                {search || filter !== 'all'
                  ? 'No hay ítems que coincidan con los filtros.'
                  : 'Aún no hay ítems en el recetario. Crea el primero.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  onDetail={setSelectedItem}
                  onEdit={openEdit}
                  onDeactivate={openDeactivate}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
