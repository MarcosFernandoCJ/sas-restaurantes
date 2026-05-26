import { useState, useEffect, useMemo } from 'react'
import { Button, Card, Spinner, Badge } from '@sas/ui'
import { useAdminApi } from '../hooks/useAdminApi'
import type { Supplier, Purchase, Ingredient } from '../types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtSoles(n: number): string {
  return (
    'S/ ' +
    n.toLocaleString('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  )
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function isToday(iso: string): boolean {
  return iso.slice(0, 10) === todayIso()
}

function isThisWeek(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - now.getDay())
  start.setHours(0, 0, 0, 0)
  return d >= start
}

// ─── Purchase line form type ──────────────────────────────────────────────────

interface PurchaseLine {
  tempId: string
  ingredientId: string
  quantity: string
  unitCost: string
}

// ─── Supplier form type ───────────────────────────────────────────────────────

interface SupplierForm {
  name: string
  contactName: string
  phone: string
  email: string
  address: string
  notes: string
}

const EMPTY_SUPPLIER_FORM: SupplierForm = {
  name: '',
  contactName: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
}

// ─── Summary cards ────────────────────────────────────────────────────────────

interface SummaryCardsProps {
  purchases: Purchase[]
}

function SummaryCards({ purchases }: SummaryCardsProps) {
  const gastoHoy = useMemo(
    () =>
      purchases
        .filter((p) => isToday(p.purchasedAt))
        .reduce((s, p) => s + p.totalCost, 0),
    [purchases]
  )
  const gastoSemana = useMemo(
    () =>
      purchases
        .filter((p) => isThisWeek(p.purchasedAt))
        .reduce((s, p) => s + p.totalCost, 0),
    [purchases]
  )
  const insumosRepuestos = useMemo(() => {
    const ids = new Set<string>()
    purchases.filter((p) => isThisWeek(p.purchasedAt)).forEach((p) => {
      p.items.forEach((item) => ids.add(item.ingredientId))
    })
    return ids.size
  }, [purchases])

  const cards = [
    { label: 'Gasto hoy', value: fmtSoles(gastoHoy), icon: '📅' },
    { label: 'Gasto semana', value: fmtSoles(gastoSemana), icon: '📆' },
    {
      label: 'Insumos repuestos',
      value: `${insumosRepuestos}`,
      icon: '📦',
      suffix: 'esta semana',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-white border border-border rounded-xl p-4 flex items-center gap-3"
        >
          <span className="text-2xl" aria-hidden="true">
            {c.icon}
          </span>
          <div>
            <p className="text-xs text-muted uppercase tracking-wide font-medium">
              {c.label}
            </p>
            <p className="text-xl font-mono font-semibold text-primary">
              {c.value}
            </p>
            {c.suffix && (
              <p className="text-xs text-muted">{c.suffix}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Purchase form modal ──────────────────────────────────────────────────────

interface PurchaseFormModalProps {
  suppliers: Supplier[]
  ingredients: Ingredient[]
  onClose: () => void
  onSaved: (purchase: Purchase) => void
}

function PurchaseFormModal({
  suppliers,
  ingredients,
  onClose,
  onSaved,
}: PurchaseFormModalProps) {
  const api = useAdminApi()
  const [supplierId, setSupplierId] = useState('')
  const [purchasedAt, setPurchasedAt] = useState(todayIso())
  const [lines, setLines] = useState<PurchaseLine[]>([
    { tempId: 't0', ingredientId: '', quantity: '', unitCost: '' },
  ])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        tempId: `t${Date.now()}${Math.random()}`,
        ingredientId: '',
        quantity: '',
        unitCost: '',
      },
    ])
  }

  function removeLine(tempId: string) {
    setLines((prev) => prev.filter((l) => l.tempId !== tempId))
  }

  function updateLine(tempId: string, field: keyof PurchaseLine, value: string) {
    setLines((prev) =>
      prev.map((l) => (l.tempId === tempId ? { ...l, [field]: value } : l))
    )
  }

  const total = lines.reduce((sum, l) => {
    const q = parseFloat(l.quantity) || 0
    const c = parseFloat(l.unitCost) || 0
    return sum + q * c
  }, 0)

  const ingredientMap = useMemo(
    () => Object.fromEntries(ingredients.map((i) => [i.id, i])),
    [ingredients]
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    const validLines = lines.filter(
      (l) =>
        l.ingredientId &&
        parseFloat(l.quantity) > 0 &&
        parseFloat(l.unitCost) > 0
    )
    if (validLines.length === 0) {
      setFormError('Agrega al menos un insumo con cantidad y costo válidos')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        supplierId: supplierId || null,
        purchasedAt: new Date(purchasedAt).toISOString(),
        items: validLines.map((l) => ({
          ingredientId: l.ingredientId,
          quantity: parseFloat(l.quantity),
          unitCost: parseFloat(l.unitCost),
        })),
      }
      const saved = await api.post<Purchase>('/admin/purchases', payload)
      onSaved(saved)
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Error al registrar compra')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Registrar compra"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="font-display text-lg font-semibold text-primary">
            Registrar compra
          </h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-primary transition-colors text-xl leading-none"
            aria-label="Cerrar modal"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <form
          id="purchase-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-5"
        >
          {/* Supplier + date row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                Proveedor
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-secondary/40"
              >
                <option value="">Sin proveedor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                Fecha de compra
              </label>
              <input
                type="date"
                value={purchasedAt}
                onChange={(e) => setPurchasedAt(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40"
              />
            </div>
          </div>

          {/* Lines */}
          <div>
            <p className="text-sm font-medium text-primary mb-2">
              Ingredientes comprados
            </p>
            <div className="space-y-2">
              {lines.map((line, idx) => {
                const ing = ingredientMap[line.ingredientId]
                const subtotal =
                  (parseFloat(line.quantity) || 0) *
                  (parseFloat(line.unitCost) || 0)
                return (
                  <div
                    key={line.tempId}
                    className="grid grid-cols-12 gap-2 items-start"
                  >
                    {/* Ingredient selector */}
                    <div className="col-span-5">
                      {idx === 0 && (
                        <p className="text-xs text-muted mb-1">Insumo</p>
                      )}
                      <select
                        value={line.ingredientId}
                        onChange={(e) =>
                          updateLine(line.tempId, 'ingredientId', e.target.value)
                        }
                        className="w-full rounded-lg border border-border px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-secondary/40"
                      >
                        <option value="">Seleccionar…</option>
                        {ingredients.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity */}
                    <div className="col-span-2">
                      {idx === 0 && (
                        <p className="text-xs text-muted mb-1">
                          Cantidad{ing ? ` (${ing.unit})` : ''}
                        </p>
                      )}
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.tempId, 'quantity', e.target.value)
                        }
                        className="w-full rounded-lg border border-border px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40"
                      />
                    </div>

                    {/* Unit cost */}
                    <div className="col-span-2">
                      {idx === 0 && (
                        <p className="text-xs text-muted mb-1">Costo unit.</p>
                      )}
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0.00"
                        value={line.unitCost}
                        onChange={(e) =>
                          updateLine(line.tempId, 'unitCost', e.target.value)
                        }
                        className="w-full rounded-lg border border-border px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40"
                      />
                    </div>

                    {/* Subtotal */}
                    <div className="col-span-2">
                      {idx === 0 && (
                        <p className="text-xs text-muted mb-1">Subtotal</p>
                      )}
                      <p className="py-2 text-sm font-mono text-muted text-right">
                        {fmtSoles(subtotal)}
                      </p>
                    </div>

                    {/* Remove */}
                    <div className={`col-span-1 flex ${idx === 0 ? 'mt-5' : ''}`}>
                      <button
                        type="button"
                        onClick={() => removeLine(line.tempId)}
                        disabled={lines.length === 1}
                        className="w-full text-muted hover:text-state-danger transition-colors disabled:opacity-30 text-lg leading-none"
                        aria-label="Eliminar línea"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              onClick={addLine}
              className="mt-3 text-sm text-secondary hover:text-secondary-hover font-medium flex items-center gap-1 transition-colors"
            >
              + Agregar ingrediente
            </button>
          </div>

          {/* Total */}
          <div className="flex justify-end border-t border-border pt-3">
            <p className="text-base font-semibold text-primary">
              Total:{' '}
              <span className="font-mono text-secondary">{fmtSoles(total)}</span>
            </p>
          </div>

          {formError && (
            <p className="text-sm text-state-danger bg-state-danger/5 border border-state-danger/20 rounded-lg px-4 py-2">
              {formError}
            </p>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border flex-shrink-0">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="purchase-form"
            loading={submitting}
          >
            Confirmar compra
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Supplier form modal ──────────────────────────────────────────────────────

interface SupplierFormModalProps {
  editing: Supplier | null
  onClose: () => void
  onSaved: (supplier: Supplier) => void
}

function SupplierFormModal({ editing, onClose, onSaved }: SupplierFormModalProps) {
  const api = useAdminApi()
  const [form, setForm] = useState<SupplierForm>(
    editing
      ? {
          name: editing.name,
          contactName: editing.contactName ?? '',
          phone: editing.phone ?? '',
          email: editing.email ?? '',
          address: editing.address ?? '',
          notes: editing.notes ?? '',
        }
      : EMPTY_SUPPLIER_FORM
  )
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function field(key: keyof SupplierForm) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((prev) => ({ ...prev, [key]: e.target.value })),
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setFormError('El nombre del proveedor es requerido')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const payload = {
        name: form.name.trim(),
        contactName: form.contactName.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      }
      const saved = editing
        ? await api.patch<Supplier>(`/admin/suppliers/${editing.id}`, payload)
        : await api.post<Supplier>('/admin/suppliers', payload)
      onSaved(saved)
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar proveedor')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-display text-lg font-semibold text-primary">
            {editing ? 'Editar proveedor' : 'Nuevo proveedor'}
          </h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-primary text-xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <form
          id="supplier-form"
          onSubmit={handleSubmit}
          className="px-6 py-4 space-y-3 overflow-y-auto"
        >
          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Nombre <span className="text-state-danger">*</span>
            </label>
            <input type="text" className={inputClass} required {...field('name')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                Contacto
              </label>
              <input type="text" className={inputClass} placeholder="Nombre" {...field('contactName')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                Teléfono
              </label>
              <input type="tel" className={inputClass} placeholder="+51 999 000 000" {...field('phone')} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Email
            </label>
            <input type="email" className={inputClass} placeholder="proveedor@ejemplo.com" {...field('email')} />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Dirección
            </label>
            <input type="text" className={inputClass} placeholder="Av. Principal 123, Lima" {...field('address')} />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Notas
            </label>
            <textarea
              rows={2}
              className={inputClass}
              placeholder="Observaciones del proveedor..."
              {...field('notes')}
            />
          </div>

          {formError && (
            <p className="text-sm text-state-danger bg-state-danger/5 border border-state-danger/20 rounded-lg px-4 py-2">
              {formError}
            </p>
          )}
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="supplier-form"
            loading={submitting}
          >
            {editing ? 'Guardar cambios' : 'Crear proveedor'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Collapsible purchase group ───────────────────────────────────────────────

interface PurchaseGroupProps {
  supplierName: string
  purchases: Purchase[]
}

function PurchaseGroup({ supplierName, purchases }: PurchaseGroupProps) {
  const [open, setOpen] = useState(true)

  const groupTotal = purchases.reduce((s, p) => s + p.totalCost, 0)

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Group header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 bg-white hover:bg-surface transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <span
            className={`text-muted transition-transform ${open ? 'rotate-90' : ''}`}
            aria-hidden="true"
          >
            ▶
          </span>
          <p className="font-medium text-primary">{supplierName}</p>
          <Badge variant="default">{purchases.length} compras</Badge>
        </div>
        <p className="font-mono text-sm font-semibold text-secondary">
          {fmtSoles(groupTotal)}
        </p>
      </button>

      {/* Purchase rows */}
      {open && (
        <div className="border-t border-border divide-y divide-border bg-[#FAFAF8]">
          {purchases.map((purchase) => (
            <div key={purchase.id} className="px-5 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted font-mono">
                    {fmtDate(purchase.purchasedAt)}
                  </span>
                  {isToday(purchase.purchasedAt) && (
                    <Badge variant="ready">Hoy</Badge>
                  )}
                </div>
                <span className="font-mono text-sm font-semibold text-primary">
                  {fmtSoles(purchase.totalCost)}
                </span>
              </div>

              {/* Items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5">
                {purchase.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-xs text-muted py-0.5"
                  >
                    <span>{item.ingredient.name}</span>
                    <span className="font-mono">
                      {item.quantity} {item.ingredient.unit} ×{' '}
                      {fmtSoles(item.unitCost)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Supplier list ────────────────────────────────────────────────────────────

interface SupplierListProps {
  suppliers: Supplier[]
  onEdit: (s: Supplier) => void
  onNew: () => void
}

function SupplierList({ suppliers, onEdit, onNew }: SupplierListProps) {
  return (
    <Card
      header={
        <div className="flex items-center justify-between">
          <span>Proveedores</span>
          <Button variant="ghost" size="sm" onClick={onNew}>
            + Nuevo
          </Button>
        </div>
      }
    >
      {suppliers.length === 0 ? (
        <p className="text-sm text-muted text-center py-6">
          Sin proveedores registrados
        </p>
      ) : (
        <div className="space-y-2">
          {suppliers.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between p-3 rounded-lg bg-[#FAFAF8] border border-border"
            >
              <div className="min-w-0">
                <p className="font-medium text-primary text-sm truncate">
                  {s.name}
                </p>
                {s.phone && (
                  <p className="text-xs text-muted">{s.phone}</p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => onEdit(s)}>
                Editar
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

export function ComprasTab() {
  const api = useAdminApi()

  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)

  const [showPurchaseForm, setShowPurchaseForm] = useState(false)
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)

  useEffect(() => {
    Promise.all([
      api.get<Purchase[]>('/admin/purchases'),
      api.get<Supplier[]>('/admin/suppliers'),
      api.get<Ingredient[]>('/admin/ingredients'),
    ])
      .then(([p, s, i]) => {
        setPurchases(p)
        setSuppliers(s)
        setIngredients(i.filter((ing) => ing.isActive))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Group purchases by supplier
  const groupedPurchases = useMemo(() => {
    const map = new Map<string, { name: string; purchases: Purchase[] }>()
    for (const p of purchases) {
      const key = p.supplierId ?? '__none__'
      const name = p.supplier?.name ?? 'Sin proveedor'
      if (!map.has(key)) map.set(key, { name, purchases: [] })
      map.get(key)!.purchases.push(p)
    }
    return Array.from(map.entries())
      .map(([key, val]) => ({ key, ...val }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [purchases])

  function handlePurchaseSaved(purchase: Purchase) {
    setPurchases((prev) => [purchase, ...prev])
    setShowPurchaseForm(false)
  }

  function handleSupplierSaved(supplier: Supplier) {
    setSuppliers((prev) => {
      const exists = prev.some((s) => s.id === supplier.id)
      return exists
        ? prev.map((s) => (s.id === supplier.id ? supplier : s))
        : [supplier, ...prev]
    })
    setShowSupplierForm(false)
    setEditingSupplier(null)
  }

  function openEditSupplier(s: Supplier) {
    setEditingSupplier(s)
    setShowSupplierForm(true)
  }

  function openNewSupplier() {
    setEditingSupplier(null)
    setShowSupplierForm(true)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" label="Cargando compras..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-primary">
            Compras
          </h2>
          <p className="text-sm text-muted mt-0.5">
            Registro de compras y gestión de proveedores
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowPurchaseForm(true)}>
          + Registrar compra
        </Button>
      </div>

      {/* Summary cards */}
      <SummaryCards purchases={purchases} />

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Purchase history */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="font-medium text-primary text-sm uppercase tracking-wide">
            Historial de compras
          </h3>
          {groupedPurchases.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl p-10 text-center text-muted text-sm">
              Sin compras registradas. Usa el botón "Registrar compra" para empezar.
            </div>
          ) : (
            groupedPurchases.map((group) => (
              <PurchaseGroup
                key={group.key}
                supplierName={group.name}
                purchases={group.purchases}
              />
            ))
          )}
        </div>

        {/* Supplier management */}
        <div>
          <SupplierList
            suppliers={suppliers}
            onEdit={openEditSupplier}
            onNew={openNewSupplier}
          />
        </div>
      </div>

      {/* Modals */}
      {showPurchaseForm && (
        <PurchaseFormModal
          suppliers={suppliers}
          ingredients={ingredients}
          onClose={() => setShowPurchaseForm(false)}
          onSaved={handlePurchaseSaved}
        />
      )}

      {showSupplierForm && (
        <SupplierFormModal
          editing={editingSupplier}
          onClose={() => {
            setShowSupplierForm(false)
            setEditingSupplier(null)
          }}
          onSaved={handleSupplierSaved}
        />
      )}
    </div>
  )
}
