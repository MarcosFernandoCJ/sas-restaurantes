import { useState, useEffect } from 'react'
import { AdminLayout } from '@/features/admin/components/AdminLayout'
import { AdminLoginForm } from '@/features/admin/components/AdminLoginForm'
import { TodayMenuSection } from '@/features/admin/components/TodayMenuSection'
import { KpiSection } from '@/features/admin/components/KpiSection'
import { CriticalIngredientsSection } from '@/features/admin/components/CriticalIngredientsSection'
import { StockAlertsBanner } from '@/features/admin/components/StockAlertsBanner'
import { InsumoTab } from '@/features/admin/components/InsumoTab'
import { RecetarioTab } from '@/features/admin/components/RecetarioTab'
import { ReportesTab } from '@/features/admin/components/ReportesTab'
import { VentasTab } from '@/features/admin/components/VentasTab'
import { ComprasTab } from '@/features/admin/components/ComprasTab'
import { ConfiguracionTab } from '@/features/admin/components/ConfiguracionTab'
import { useAdminAuthStore } from '@/features/admin/store/admin-auth.store'
import { useAdminSocket } from '@/features/admin/hooks/useAdminSocket'
import { useAdminApi, AdminApiError } from '@/features/admin/hooks/useAdminApi'
import type { AdminTab, DailyMenuItem } from '@/features/admin/types'

// ─── Journey Control ──────────────────────────────────────────────────────────

interface JourneySession {
  id: string
  startedAt: string
  status: string
}

function JourneyControl() {
  const api = useAdminApi()
  const [session, setSession] = useState<JourneySession | null | undefined>(undefined) // undefined = loading
  const [operating, setOperating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<JourneySession | null>('/journey/current')
      .then(setSession)
      .catch(() => setSession(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleStart = async () => {
    setOperating(true)
    setError(null)
    try {
      const s = await api.post<JourneySession>('/journey/start', {})
      setSession(s)
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'Error al iniciar jornada')
    } finally {
      setOperating(false)
    }
  }

  const handleEnd = async () => {
    if (!confirm('¿Cerrar la jornada? Se validará que no haya pedidos activos.')) return
    setOperating(true)
    setError(null)
    try {
      await api.post('/journey/end', {})
      setSession(null)
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'Error al cerrar jornada')
    } finally {
      setOperating(false)
    }
  }

  const isLoading = session === undefined

  const startedLabel =
    session?.startedAt
      ? new Date(session.startedAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
      : null

  return (
    <div
      className={[
        'rounded-2xl border-2 p-5 flex flex-col gap-4',
        session ? 'border-[#1A6B3C] bg-[#1A6B3C]/5' : 'border-border bg-white',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className={[
              'w-10 h-10 rounded-full flex items-center justify-center text-xl',
              session ? 'bg-[#1A6B3C]/15' : 'bg-border',
            ].join(' ')}
          >
            {session ? '🟢' : '🔒'}
          </div>
          <div>
            <h3 className="font-display font-bold text-primary text-base">
              {isLoading ? 'Verificando…' : session ? 'Jornada activa' : 'Local cerrado'}
            </h3>
            <p className="text-xs text-muted font-body">
              {session
                ? `Abierta desde las ${startedLabel ?? '—'}`
                : 'Inicia la jornada para habilitar pedidos'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLoading ? (
            <span className="text-xs text-muted animate-pulse">Cargando…</span>
          ) : session ? (
            <button
              type="button"
              onClick={handleEnd}
              disabled={operating}
              className="text-sm font-semibold px-4 py-2 rounded-xl border-2 border-[#C8410A]/40 text-[#C8410A] hover:bg-[#C8410A]/5 disabled:opacity-50 transition-colors"
            >
              {operating ? 'Cerrando…' : 'Cerrar jornada'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              disabled={operating}
              className="text-sm font-semibold px-4 py-2 rounded-xl bg-[#1A6B3C] text-white hover:bg-[#1A6B3C]/90 disabled:opacity-50 transition-colors"
            >
              {operating ? 'Abriendo…' : 'Iniciar jornada'}
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-[#C8410A] bg-[#C8410A]/5 rounded-lg px-3 py-2 border border-[#C8410A]/20">
          {error}
        </p>
      )}

      {/* Info: closing validation */}
      {session && (
        <p className="text-xs text-muted">
          Solo puedes cerrar la jornada cuando todos los pedidos estén entregados.
          Los meseros quedarán bloqueados automáticamente al cierre.
        </p>
      )}
    </div>
  )
}

// ─── Tab "Inicio" — fetches daily menu once, shares it with children ─────────

function InicioTab() {
  const api = useAdminApi()
  const [dailyMenu, setDailyMenu] = useState<DailyMenuItem[]>([])
  const [dailyMenuLoading, setDailyMenuLoading] = useState(true)

  useEffect(() => {
    api
      .get<DailyMenuItem[]>('/admin/daily-menu/today')
      .then(setDailyMenu)
      .catch(() => {})
      .finally(() => setDailyMenuLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleMenuChange = (updater: (prev: DailyMenuItem[]) => DailyMenuItem[]) => {
    setDailyMenu(updater)
  }

  return (
    <div className="space-y-6">
      {/* Journey control — prominent at top of dashboard */}
      <JourneyControl />

      <StockAlertsBanner />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TodayMenuSection
          dailyMenu={dailyMenu}
          loading={dailyMenuLoading}
          onMenuChange={handleMenuChange}
        />
        <KpiSection />
      </div>

      <CriticalIngredientsSection
        dailyMenuItems={dailyMenu}
        dailyMenuLoading={dailyMenuLoading}
      />
    </div>
  )
}

// ─── Authenticated dashboard shell ────────────────────────────────────────────

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>('inicio')

  // Connect to room:admin for real-time KPI and stock alerts
  useAdminSocket()

  return (
    <AdminLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'inicio'        && <InicioTab />}
      {activeTab === 'insumos'       && <InsumoTab />}
      {activeTab === 'recetario'     && <RecetarioTab />}
      {activeTab === 'ventas'        && <VentasTab />}
      {activeTab === 'reportes'      && <ReportesTab />}
      {activeTab === 'compras'       && <ComprasTab />}
      {activeTab === 'configuracion' && <ConfiguracionTab />}
    </AdminLayout>
  )
}

// ─── Page: guard with login form ──────────────────────────────────────────────

export function AdminDashboardPage() {
  const token = useAdminAuthStore((s) => s.token)
  return token ? <AdminDashboard /> : <AdminLoginForm />
}
