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
import { ComprasTab } from '@/features/admin/components/ComprasTab'
import { ConfiguracionTab } from '@/features/admin/components/ConfiguracionTab'
import { useAdminAuthStore } from '@/features/admin/store/admin-auth.store'
import { useAdminSocket } from '@/features/admin/hooks/useAdminSocket'
import { useAdminApi } from '@/features/admin/hooks/useAdminApi'
import type { AdminTab, DailyMenuItem } from '@/features/admin/types'

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
