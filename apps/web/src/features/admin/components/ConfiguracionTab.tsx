import { useState, useEffect } from 'react'
import { Card, Button, Badge, Spinner } from '@sas/ui'
import type { BadgeVariant } from '@sas/ui'
import { useAdminApi } from '../hooks/useAdminApi'
import type {
  SystemUser, UserRole, RestaurantTable, SystemParams,
  TableMode, WaiterTableAssignment,
} from '../types'

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<UserRole, { label: string; variant: BadgeVariant }> = {
  admin:  { label: 'Admin',  variant: 'delivery' },
  waiter: { label: 'Mesero', variant: 'in_prep' },
  chef:   { label: 'Chef',   variant: 'additional' },
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin',  label: 'Admin' },
  { value: 'waiter', label: 'Mesero' },
  { value: 'chef',   label: 'Chef' },
]

const SECTIONS = ['Salón Principal', 'Terraza', 'Barra', 'VIP', 'Jardín']

const INPUT_CLS =
  'w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white'

// ─── UserFormModal ────────────────────────────────────────────────────────────

interface UserFormState {
  name: string
  email: string
  password: string
  role: UserRole
  isActive: boolean
}

function UserFormModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: SystemUser | null
  onClose: () => void
  onSaved: (u: SystemUser) => void
}) {
  const api = useAdminApi()
  const [form, setForm] = useState<UserFormState>({
    name: editing?.name ?? '',
    email: editing?.email ?? '',
    password: '',
    role: editing?.role ?? 'waiter',
    isActive: editing?.isActive ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function patchForm<K extends keyof UserFormState>(key: K, value: UserFormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) {
      setError('Nombre y correo son obligatorios')
      return
    }
    if (!editing && !form.password.trim()) {
      setError('La contraseña temporal es obligatoria')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const saved = editing
        ? await api.patch<SystemUser>(`/admin/users/${editing.id}`, {
            name: form.name.trim(),
            email: form.email.trim(),
            role: form.role,
            isActive: form.isActive,
          })
        : await api.post<SystemUser>('/admin/users', {
            name: form.name.trim(),
            email: form.email.trim(),
            password: form.password,
            role: form.role,
          })
      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar usuario')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-display font-semibold text-primary">
            {editing ? 'Editar usuario' : 'Nuevo usuario'}
          </h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-primary text-xl leading-none">
            ✕
          </button>
        </div>

        <form id="user-form" onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary mb-1">Nombre</label>
            <input
              type="text"
              value={form.name}
              onChange={e => patchForm('name', e.target.value)}
              className={INPUT_CLS}
              placeholder="Nombre completo"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1">Correo electrónico</label>
            <input
              type="email"
              value={form.email}
              onChange={e => patchForm('email', e.target.value)}
              className={INPUT_CLS}
              placeholder="correo@ejemplo.com"
              required
            />
          </div>

          {!editing && (
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Contraseña temporal</label>
              <input
                type="password"
                value={form.password}
                onChange={e => patchForm('password', e.target.value)}
                className={INPUT_CLS}
                placeholder="Mínimo 8 caracteres"
              />
              <p className="text-xs text-muted mt-1">El usuario deberá cambiarla en su primer inicio.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-primary mb-1">Rol</label>
            <select
              value={form.role}
              onChange={e => patchForm('role', e.target.value as UserRole)}
              className={INPUT_CLS}
            >
              {ROLE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {editing && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                id="user-active"
                type="checkbox"
                checked={form.isActive}
                onChange={e => patchForm('isActive', e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <span className="text-sm font-medium text-primary">Usuario activo</span>
            </label>
          )}

          {error && <p className="text-sm text-state-danger">{error}</p>}
        </form>

        <div className="flex justify-end gap-3 px-5 pb-5">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="user-form" size="sm" loading={saving}>
            {editing ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── TableFormModal ───────────────────────────────────────────────────────────

interface TableFormState {
  number: string
  capacity: string
  section: string
}

function TableFormModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: RestaurantTable | null
  onClose: () => void
  onSaved: (t: RestaurantTable) => void
}) {
  const api = useAdminApi()
  const [form, setForm] = useState<TableFormState>({
    number: editing?.number.toString() ?? '',
    capacity: editing?.capacity.toString() ?? '4',
    section: editing?.section ?? SECTIONS[0],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function patchForm(key: keyof TableFormState, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const num = parseInt(form.number)
    const cap = parseInt(form.capacity)
    if (!num || num < 1 || !cap || cap < 1 || !form.section.trim()) {
      setError('Todos los campos son obligatorios y deben ser positivos')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const body = { number: num, capacity: cap, section: form.section.trim() }
      const saved = editing
        ? await api.patch<RestaurantTable>(`/admin/tables/${editing.id}`, body)
        : await api.post<RestaurantTable>('/admin/tables', body)
      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar mesa')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-display font-semibold text-primary">
            {editing ? 'Editar mesa' : 'Nueva mesa'}
          </h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-primary text-xl leading-none">
            ✕
          </button>
        </div>

        <form id="table-form" onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Número</label>
              <input
                type="number" min="1" max="999"
                value={form.number}
                onChange={e => patchForm('number', e.target.value)}
                className={INPUT_CLS}
                placeholder="1"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Capacidad</label>
              <input
                type="number" min="1" max="30"
                value={form.capacity}
                onChange={e => patchForm('capacity', e.target.value)}
                className={INPUT_CLS}
                placeholder="4"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1">Sección</label>
            <input
              list="section-suggestions"
              type="text"
              value={form.section}
              onChange={e => patchForm('section', e.target.value)}
              className={INPUT_CLS}
              placeholder="Salón Principal"
            />
            <datalist id="section-suggestions">
              {SECTIONS.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          {error && <p className="text-sm text-state-danger">{error}</p>}
        </form>

        <div className="flex justify-end gap-3 px-5 pb-5">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="table-form" size="sm" loading={saving}>
            {editing ? 'Guardar cambios' : 'Crear mesa'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── TableAssignmentsCard ─────────────────────────────────────────────────────
// Visible only when tableMode === 'assigned'.
// Admin picks which tables each waiter is responsible for today.

function TableAssignmentsCard({
  waiters,
  allTables,
}: {
  waiters: SystemUser[]
  allTables: Pick<RestaurantTable, 'id' | 'number' | 'section'>[]
}) {
  const api = useAdminApi()
  const [assignments, setAssignments] = useState<Record<string, Set<string>>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<WaiterTableAssignment[]>('/admin/table-assignments')
      .then((list) => {
        const map: Record<string, Set<string>> = {}
        for (const a of list) {
          map[a.waiterId] = new Set(a.tables.map((t) => t.id))
        }
        setAssignments(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleTable(waiterId: string, tableId: string) {
    setAssignments((prev) => {
      const current = new Set(prev[waiterId] ?? [])
      if (current.has(tableId)) current.delete(tableId)
      else current.add(tableId)
      return { ...prev, [waiterId]: current }
    })
  }

  async function saveWaiter(waiterId: string) {
    setSaving(waiterId)
    try {
      await api.post('/admin/table-assignments', {
        waiterId,
        tableIds: Array.from(assignments[waiterId] ?? []),
      })
    } catch {
      // keep UI state — error is silent for now
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="md" label="Cargando asignaciones..." />
      </div>
    )
  }

  const waiterList = waiters.filter((u) => u.role === 'waiter' && u.isActive)

  return (
    <div className="space-y-4">
      {waiterList.length === 0 && (
        <p className="text-sm text-muted text-center py-6">No hay meseros activos.</p>
      )}
      {waiterList.map((waiter) => {
        const assigned = assignments[waiter.id] ?? new Set()
        return (
          <div key={waiter.id} className="border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <div>
                <p className="font-semibold text-primary text-sm">{waiter.name}</p>
                <p className="text-xs text-muted">{assigned.size} mesa{assigned.size !== 1 ? 's' : ''} asignada{assigned.size !== 1 ? 's' : ''}</p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => saveWaiter(waiter.id)}
                loading={saving === waiter.id}
                disabled={saving !== null && saving !== waiter.id}
              >
                Guardar
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {[...allTables].sort((a, b) => a.number - b.number).map((table) => {
                const isAssigned = assigned.has(table.id)
                return (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => toggleTable(waiter.id, table.id)}
                    className={[
                      'rounded-lg border-2 px-3 py-1.5 text-sm font-mono font-semibold transition-all',
                      isAssigned
                        ? 'border-secondary bg-secondary/10 text-secondary'
                        : 'border-border text-muted hover:border-secondary/50',
                    ].join(' ')}
                    title={`Mesa ${table.number} — ${table.section ?? 'Sin sección'}`}
                  >
                    #{table.number}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

export function ConfiguracionTab() {
  const api = useAdminApi()

  const [users, setUsers] = useState<SystemUser[]>([])
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [params, setParams] = useState<SystemParams>({
    reminderIntervalMin: 3,
    criticalTimerMin: 15,
    tableMode: 'free',
  })
  const [loading, setLoading] = useState(true)

  const [showUserForm, setShowUserForm] = useState(false)
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null)
  const [showTableForm, setShowTableForm] = useState(false)
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null)

  const [paramsSaving, setParamsSaving] = useState(false)
  const [paramsMsg, setParamsMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    Promise.all([
      api.get<SystemUser[]>('/admin/users'),
      api.get<RestaurantTable[]>('/admin/tables'),
      api.get<SystemParams>('/admin/system-params'),
    ])
      .then(([u, t, p]) => {
        setUsers(u)
        setTables(t)
        setParams(p)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── User handlers ──────────────────────────────────────────────────────────

  function openCreateUser() { setEditingUser(null); setShowUserForm(true) }
  function openEditUser(u: SystemUser) { setEditingUser(u); setShowUserForm(true) }
  function closeUserForm() { setShowUserForm(false); setEditingUser(null) }
  function handleUserSaved(saved: SystemUser) {
    setUsers(prev => {
      const idx = prev.findIndex(u => u.id === saved.id)
      return idx >= 0 ? prev.map(u => (u.id === saved.id ? saved : u)) : [saved, ...prev]
    })
    closeUserForm()
  }

  // ── Table handlers ─────────────────────────────────────────────────────────

  function openCreateTable() { setEditingTable(null); setShowTableForm(true) }
  function openEditTable(t: RestaurantTable) { setEditingTable(t); setShowTableForm(true) }
  function closeTableForm() { setShowTableForm(false); setEditingTable(null) }
  function handleTableSaved(saved: RestaurantTable) {
    setTables(prev => {
      const idx = prev.findIndex(t => t.id === saved.id)
      return idx >= 0
        ? prev.map(t => (t.id === saved.id ? saved : t))
        : [...prev, saved].sort((a, b) => a.number - b.number)
    })
    closeTableForm()
  }
  async function handleRemoveTable(id: string) {
    try {
      await api.patch(`/admin/tables/${id}`, { isActive: false })
      setTables(prev => prev.filter(t => t.id !== id))
    } catch {
      // silent — table remains visible if delete fails (e.g., FK constraint)
    }
  }

  // ── Params handler ─────────────────────────────────────────────────────────

  async function handleSaveParams(e: React.FormEvent) {
    e.preventDefault()
    setParamsSaving(true)
    setParamsMsg(null)
    try {
      const saved = await api.patch<SystemParams>('/admin/system-params', params)
      setParams(saved)
      setParamsMsg({ ok: true, text: 'Parámetros guardados correctamente.' })
    } catch (err) {
      setParamsMsg({
        ok: false,
        text: err instanceof Error ? err.message : 'Error al guardar',
      })
    } finally {
      setParamsSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" label="Cargando configuración..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-display text-xl font-semibold text-primary">Configuración</h2>
        <p className="text-sm text-muted mt-0.5">Usuarios, mesas y parámetros del sistema</p>
      </div>

      {/* ── Usuarios ──────────────────────────────────────────────────────────── */}
      <Card
        header={
          <div className="flex items-center justify-between">
            <span>Usuarios del sistema</span>
            <Button type="button" size="sm" onClick={openCreateUser}>+ Nuevo usuario</Button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Nombre', 'Correo', 'Rol', 'Estado', ''].map((h, i) => (
                  <th
                    key={i}
                    className="text-left py-2 px-3 font-medium text-muted text-xs uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted">Sin usuarios registrados</td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="border-b border-border/50 hover:bg-surface/60">
                    <td className="py-3 px-3 font-medium text-primary">{user.name}</td>
                    <td className="py-3 px-3 text-muted text-xs">{user.email}</td>
                    <td className="py-3 px-3">
                      <Badge variant={ROLE_CONFIG[user.role].variant}>{ROLE_CONFIG[user.role].label}</Badge>
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant={user.isActive ? 'ready' : 'default'}>
                        {user.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Button type="button" variant="ghost" size="sm" onClick={() => openEditUser(user)}>
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Mesas ─────────────────────────────────────────────────────────────── */}
      <Card
        header={
          <div className="flex items-center justify-between">
            <span>Mesas del restaurante</span>
            <Button type="button" size="sm" onClick={openCreateTable}>+ Nueva mesa</Button>
          </div>
        }
      >
        {tables.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">Sin mesas registradas</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {[...tables].sort((a, b) => a.number - b.number).map(t => (
              <div key={t.id} className="rounded-lg border border-border bg-white p-3 flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <span className="font-mono font-bold text-primary text-lg">#{t.number}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTable(t.id)}
                    className="text-muted hover:text-state-danger text-xs transition-colors leading-none"
                    title="Eliminar mesa"
                  >
                    ✕
                  </button>
                </div>
                <div className="text-xs text-muted space-y-0.5">
                  <p>Capacidad: <span className="font-medium text-primary">{t.capacity} pers.</span></p>
                  <p className="truncate">{t.section}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => openEditTable(t)}
                >
                  Editar
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Parámetros del Sistema ─────────────────────────────────────────────── */}
      <Card header="Parámetros del sistema">
        <form onSubmit={handleSaveParams} className="space-y-5">
          {/* Table mode toggle */}
          <div>
            <p className="text-sm font-medium text-primary mb-2">Modalidad de asignación de mesas</p>
            <div className="flex gap-3">
              {([
                { value: 'free', label: 'Libre', desc: 'Cualquier mesero atiende cualquier mesa' },
                { value: 'assigned', label: 'Asignación fija', desc: 'Cada mesero tiene mesas asignadas' },
              ] as { value: TableMode; label: string; desc: string }[]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setParams(p => ({ ...p, tableMode: opt.value }))}
                  className={[
                    'flex-1 rounded-xl border-2 p-3 text-left transition-all',
                    params.tableMode === opt.value
                      ? 'border-secondary bg-secondary/5'
                      : 'border-border hover:border-secondary/40',
                  ].join(' ')}
                >
                  <p className="font-semibold text-primary text-sm">{opt.label}</p>
                  <p className="text-xs text-muted mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                Intervalo de recordatorio al mesero (min)
              </label>
              <input
                type="number" min="1" max="60"
                value={params.reminderIntervalMin}
                onChange={e => setParams(p => ({ ...p, reminderIntervalMin: parseInt(e.target.value) || p.reminderIntervalMin }))}
                className={INPUT_CLS}
              />
              <p className="text-xs text-muted mt-1">Cada cuántos minutos se recuerda al mesero los pedidos pendientes. Default: 3 min.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                Umbral de timer crítico en cocina (min)
              </label>
              <input
                type="number" min="1" max="60"
                value={params.criticalTimerMin}
                onChange={e => setParams(p => ({ ...p, criticalTimerMin: parseInt(e.target.value) || p.criticalTimerMin }))}
                className={INPUT_CLS}
              />
              <p className="text-xs text-muted mt-1">Minutos desde que el pedido entra a cocina hasta que el timer se pone en rojo. Default: 15 min.</p>
            </div>
          </div>

          {paramsMsg && (
            <p className={`text-sm ${paramsMsg.ok ? 'text-state-ready' : 'text-state-danger'}`}>
              {paramsMsg.text}
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" loading={paramsSaving}>Guardar parámetros</Button>
          </div>
        </form>
      </Card>

      {/* ── Asignación de mesas ─────────────────────────────────────────────────
          Visible solo cuando tableMode = 'assigned'.
          Admin elige qué mesas atiende cada mesero hoy.
      */}
      {params.tableMode === 'assigned' && (
        <Card header="Asignación de mesas por mesero (hoy)">
          <p className="text-xs text-muted mb-4">
            Selecciona las mesas de cada mesero para el turno de hoy. Los cambios se guardan de forma individual.
          </p>
          <TableAssignmentsCard
            waiters={users}
            allTables={tables}
          />
        </Card>
      )}

      {/* Modals */}
      {showUserForm && (
        <UserFormModal editing={editingUser} onClose={closeUserForm} onSaved={handleUserSaved} />
      )}
      {showTableForm && (
        <TableFormModal editing={editingTable} onClose={closeTableForm} onSaved={handleTableSaved} />
      )}
    </div>
  )
}
