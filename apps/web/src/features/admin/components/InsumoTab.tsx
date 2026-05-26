import { useState, useEffect, useMemo } from 'react'
import { Card, Button, Badge, Spinner } from '@sas/ui'
import type { BadgeVariant } from '@sas/ui'
import { useAdminApi } from '../hooks/useAdminApi'
import type { Ingredient, IngredientStatus, DailyMenuItem } from '../types'

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

const UNITS = ['kg', 'g', 'lt', 'ml', 'unidad', 'paquete', 'bolsa', 'docena', 'lata', 'otro']

const STATUS_CONFIG: Record<IngredientStatus, { variant: BadgeVariant; label: string }> = {
  out:      { variant: 'delivery',   label: 'Agotado' },
  critical: { variant: 'additional', label: 'Crítico' },
  low:      { variant: 'pending',    label: 'Bajo' },
  ok:       { variant: 'ready',      label: 'OK' },
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface IngredientFormData {
  name: string
  unit: string
  stockQty: string
  minStockQty: string
  unitCost: string
}

const EMPTY_FORM: IngredientFormData = {
  name: '',
  unit: 'kg',
  stockQty: '0',
  minStockQty: '0',
  unitCost: '0',
}

// ─── Critical Menu Alert ──────────────────────────────────────────────────────

function CriticalMenuAlert({
  names,
  onDismiss,
}: {
  names: string[]
  onDismiss: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="critical-alert-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss()
      }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="text-3xl shrink-0" aria-hidden="true">⚠️</span>
          <div className="flex-1 min-w-0">
            <h2 id="critical-alert-title" className="font-display text-lg font-bold text-primary">
              Insumos críticos en el menú de hoy
            </h2>
            <p className="text-sm text-muted mt-1">
              Estos insumos están agotados o en estado crítico y aparecen en el menú confirmado de hoy:
            </p>
          </div>
          <button
            onClick={onDismiss}
            aria-label="Cerrar alerta"
            className="text-muted hover:text-primary text-2xl leading-none transition-colors shrink-0"
          >
            ×
          </button>
        </div>
        <ul className="space-y-1.5 pl-2">
          {names.map((name) => (
            <li key={name} className="flex items-center gap-2 text-sm text-primary">
              <span className="w-2 h-2 rounded-full bg-secondary shrink-0" aria-hidden="true" />
              {name}
            </li>
          ))}
        </ul>
        <div className="flex justify-end pt-1">
          <Button variant="primary" size="sm" onClick={onDismiss}>
            Entendido
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Ingredient Form Modal ────────────────────────────────────────────────────

function IngredientFormModal({
  ingredient,
  onSave,
  onClose,
}: {
  ingredient: Ingredient | null
  onSave: (data: IngredientFormData) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<IngredientFormData>(
    ingredient
      ? {
          name: ingredient.name,
          unit: ingredient.unit,
          stockQty: String(ingredient.stockQty),
          minStockQty: String(ingredient.minStockQty),
          unitCost: String(ingredient.unitCost),
        }
      : EMPTY_FORM
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set =
    (field: keyof IngredientFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('El nombre es requerido')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(form)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
      setSaving(false)
    }
  }

  const inputCls =
    'w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ing-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 id="ing-form-title" className="font-display text-lg font-bold text-primary">
            {ingredient ? 'Editar insumo' : 'Nuevo insumo'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar formulario"
            className="text-muted hover:text-primary text-2xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="ing-name" className="block text-sm font-medium text-primary mb-1">
              Nombre *
            </label>
            <input
              id="ing-name"
              type="text"
              value={form.name}
              onChange={set('name')}
              className={inputCls}
              placeholder="Ej: Pollo entero"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="ing-unit" className="block text-sm font-medium text-primary mb-1">
                Unidad *
              </label>
              <select
                id="ing-unit"
                value={form.unit}
                onChange={set('unit')}
                className={inputCls}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ing-stock" className="block text-sm font-medium text-primary mb-1">
                Stock actual
              </label>
              <input
                id="ing-stock"
                type="number"
                min="0"
                step="0.001"
                value={form.stockQty}
                onChange={set('stockQty')}
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="ing-min" className="block text-sm font-medium text-primary mb-1">
                Stock mínimo
              </label>
              <input
                id="ing-min"
                type="number"
                min="0"
                step="0.001"
                value={form.minStockQty}
                onChange={set('minStockQty')}
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="ing-cost" className="block text-sm font-medium text-primary mb-1">
                Costo unit. (S/)
              </label>
              <input
                id="ing-cost"
                type="number"
                min="0"
                step="0.0001"
                value={form.unitCost}
                onChange={set('unitCost')}
                className={inputCls}
              />
            </div>
          </div>

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
              {ingredient ? 'Guardar cambios' : 'Crear insumo'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Confirm Deactivate Dialog ────────────────────────────────────────────────

function ConfirmDeactivate({
  ingredientName,
  onConfirm,
  onCancel,
  loading,
}: {
  ingredientName: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="deactivate-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
        <h2 id="deactivate-title" className="font-display text-base font-bold text-primary">
          ¿Desactivar insumo?
        </h2>
        <p className="text-sm text-muted">
          El insumo <span className="font-semibold text-primary">"{ingredientName}"</span> quedará
          inactivo. No se eliminarán los datos históricos y podrá reactivarse desde la base de datos.
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

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({
  ingredients,
  mostUsed,
}: {
  ingredients: Ingredient[]
  mostUsed: { name: string; unit: string; total: number } | null
}) {
  const urgent = ingredients.filter((i) => i.status !== 'ok')

  const repositionCost = urgent.reduce((acc, i) => {
    const deficit = Math.max(0, i.minStockQty - i.stockQty)
    return acc + deficit * i.unitCost
  }, 0)

  const mostCritical = [...urgent].sort(
    (a, b) =>
      a.stockQty / Math.max(a.minStockQty, 0.001) -
      b.stockQty / Math.max(b.minStockQty, 0.001)
  )[0]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
          Insumo más crítico
        </p>
        {mostCritical ? (
          <>
            <p className="font-semibold text-primary truncate">{mostCritical.name}</p>
            <p className="text-xs text-muted mt-0.5 font-mono">
              {mostCritical.stockQty.toFixed(3)} {mostCritical.unit} en stock
            </p>
            <div className="mt-2">
              <Badge variant={STATUS_CONFIG[mostCritical.status].variant}>
                {STATUS_CONFIG[mostCritical.status].label}
              </Badge>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">Sin alertas críticas</p>
        )}
      </Card>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
          Costo de reposición
        </p>
        <p className="font-display text-2xl font-bold text-primary">
          S/ {repositionCost.toFixed(2)}
        </p>
        <p className="text-xs text-muted mt-1">{urgent.length} insumos bajo mínimo</p>
      </Card>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
          Más usado hoy
        </p>
        {mostUsed ? (
          <>
            <p className="font-semibold text-primary truncate">{mostUsed.name}</p>
            <p className="text-xs text-muted mt-0.5 font-mono">
              {mostUsed.total.toFixed(3)} {mostUsed.unit} necesarios
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">Sin menú confirmado</p>
        )}
      </Card>
    </div>
  )
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export function InsumoTab() {
  const api = useAdminApi()

  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)

  // Alert
  const [alertNames, setAlertNames] = useState<string[]>([])
  const [alertDismissed, setAlertDismissed] = useState(false)
  const [mostUsed, setMostUsed] = useState<{
    name: string
    unit: string
    total: number
  } | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<IngredientStatus | 'all'>('all')
  const [page, setPage] = useState(1)

  // CRUD
  const [showForm, setShowForm] = useState(false)
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null)
  const [showDeactivate, setShowDeactivate] = useState(false)
  const [deactivatingIngredient, setDeactivatingIngredient] = useState<Ingredient | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  // ── Fetch on mount ────────────────────────────────────────────────────────

  useEffect(() => {
    api
      .get<Ingredient[]>('/admin/ingredients')
      .then(setIngredients)
      .catch(() => {})
      .finally(() => setLoading(false))

    api
      .get<DailyMenuItem[]>('/admin/daily-menu/today')
      .then((menu) => {
        const alertSet = new Set<string>()
        const usageMap = new Map<string, { name: string; unit: string; total: number }>()

        for (const entry of menu) {
          for (const recipe of entry.menuItem.recipes) {
            const { ingredient, quantityNeeded } = recipe

            // Alert: critical/out in confirmed menu
            if (entry.confirmedAt && (ingredient.status === 'critical' || ingredient.status === 'out')) {
              alertSet.add(ingredient.name)
            }

            // Usage: sum needed quantities
            const existing = usageMap.get(ingredient.id)
            if (existing) {
              existing.total += quantityNeeded
            } else {
              usageMap.set(ingredient.id, {
                name: ingredient.name,
                unit: ingredient.unit,
                total: quantityNeeded,
              })
            }
          }
        }

        setAlertNames(Array.from(alertSet))

        const sorted = Array.from(usageMap.values()).sort((a, b) => b.total - a.total)
        setMostUsed(sorted[0] ?? null)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Client-side filter + pagination ──────────────────────────────────────

  const filtered = useMemo(() => {
    let list = ingredients
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((i) => i.name.toLowerCase().includes(q))
    }
    if (statusFilter !== 'all') {
      list = list.filter((i) => i.status === statusFilter)
    }
    return list
  }, [ingredients, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const handleSearchChange = (val: string) => {
    setSearch(val)
    setPage(1)
  }

  const handleStatusChange = (val: IngredientStatus | 'all') => {
    setStatusFilter(val)
    setPage(1)
  }

  // ── CRUD handlers ─────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingIngredient(null)
    setShowForm(true)
  }

  const openEdit = (ing: Ingredient) => {
    setEditingIngredient(ing)
    setShowForm(true)
  }

  const openDeactivate = (ing: Ingredient) => {
    setDeactivatingIngredient(ing)
    setShowDeactivate(true)
  }

  const handleSave = async (data: IngredientFormData): Promise<void> => {
    const body = {
      name: data.name.trim(),
      unit: data.unit,
      stockQty: parseFloat(data.stockQty) || 0,
      minStockQty: parseFloat(data.minStockQty) || 0,
      unitCost: parseFloat(data.unitCost) || 0,
    }

    if (editingIngredient) {
      const updated = await api.patch<Ingredient>(
        `/admin/ingredients/${editingIngredient.id}`,
        body
      )
      setIngredients((prev) => prev.map((i) => (i.id === editingIngredient.id ? updated : i)))
    } else {
      const created = await api.post<Ingredient>('/admin/ingredients', body)
      setIngredients((prev) => [...prev, created])
    }

    setShowForm(false)
  }

  const handleDeactivate = async () => {
    if (!deactivatingIngredient) return
    setDeactivating(true)
    try {
      await api.patch(`/admin/ingredients/${deactivatingIngredient.id}`, { isActive: false })
      setIngredients((prev) => prev.filter((i) => i.id !== deactivatingIngredient.id))
      setShowDeactivate(false)
      setDeactivatingIngredient(null)
    } catch {
      // keep dialog open
    } finally {
      setDeactivating(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const showAlert = alertNames.length > 0 && !alertDismissed

  return (
    <div className="space-y-6">
      {showAlert && (
        <CriticalMenuAlert names={alertNames} onDismiss={() => setAlertDismissed(true)} />
      )}

      {showForm && (
        <IngredientFormModal
          ingredient={editingIngredient}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
        />
      )}

      {showDeactivate && deactivatingIngredient && (
        <ConfirmDeactivate
          ingredientName={deactivatingIngredient.name}
          onConfirm={handleDeactivate}
          onCancel={() => setShowDeactivate(false)}
          loading={deactivating}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" label="Cargando insumos..." />
        </div>
      ) : (
        <>
          <SummaryCards ingredients={ingredients} mostUsed={mostUsed} />

          <Card
            header={
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="font-semibold text-primary">📦 Inventario de Insumos</span>
                <Button variant="primary" size="sm" onClick={openCreate}>
                  + Nuevo insumo
                </Button>
              </div>
            }
          >
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <input
                type="search"
                placeholder="Buscar insumo..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40"
                aria-label="Buscar insumo por nombre"
              />
              <select
                value={statusFilter}
                onChange={(e) =>
                  handleStatusChange(e.target.value as IngredientStatus | 'all')
                }
                className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40"
                aria-label="Filtrar por estado"
              >
                <option value="all">Todos los estados</option>
                <option value="out">Agotado</option>
                <option value="critical">Crítico</option>
                <option value="low">Bajo</option>
                <option value="ok">OK</option>
              </select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-sm min-w-[680px]">
                <thead>
                  <tr className="border-b border-border">
                    {[
                      { label: 'Insumo', align: 'text-left pr-3' },
                      { label: 'Unidad', align: 'text-right px-3' },
                      { label: 'Stock actual', align: 'text-right px-3' },
                      { label: 'Mín. stock', align: 'text-right px-3' },
                      { label: 'Costo unit.', align: 'text-right px-3' },
                      { label: 'Estado', align: 'text-center px-3' },
                      { label: 'Acciones', align: 'text-center pl-3' },
                    ].map(({ label, align }) => (
                      <th
                        key={label}
                        scope="col"
                        className={`py-2 text-xs font-semibold uppercase tracking-wide text-muted ${align}`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-14 text-center text-sm text-muted">
                        {search || statusFilter !== 'all'
                          ? 'No hay insumos que coincidan con los filtros.'
                          : 'No hay insumos registrados aún.'}
                      </td>
                    </tr>
                  ) : (
                    paginated.map((ing) => {
                      const cfg = STATUS_CONFIG[ing.status]
                      const stockLow = ing.stockQty < ing.minStockQty
                      return (
                        <tr
                          key={ing.id}
                          className="border-b border-border/50 hover:bg-surface/60 transition-colors"
                        >
                          <td className="py-2.5 pr-3 font-medium text-primary whitespace-nowrap">
                            {ing.name}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-muted">
                            {ing.unit}
                          </td>
                          <td
                            className={[
                              'py-2.5 px-3 text-right font-mono tabular-nums',
                              stockLow ? 'text-secondary font-semibold' : 'text-muted',
                            ].join(' ')}
                          >
                            {ing.stockQty.toFixed(3)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-muted tabular-nums">
                            {ing.minStockQty.toFixed(3)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-muted tabular-nums">
                            S/ {ing.unitCost.toFixed(4)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge variant={cfg.variant}>{cfg.label}</Badge>
                          </td>
                          <td className="py-2.5 pl-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(ing)}
                                aria-label={`Editar ${ing.name}`}
                              >
                                Editar
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => openDeactivate(ing)}
                                aria-label={`Desactivar ${ing.name}`}
                              >
                                Desactivar
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm flex-wrap gap-2">
                <p className="text-muted">
                  {filtered.length === 0
                    ? 'Sin resultados'
                    : `Mostrando ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(
                        currentPage * PAGE_SIZE,
                        filtered.length
                      )} de ${filtered.length}`}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    ← Anterior
                  </Button>
                  <span className="text-muted font-mono text-xs">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Siguiente →
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
