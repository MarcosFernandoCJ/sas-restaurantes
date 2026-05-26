import React from 'react'
import { Button } from '@sas/ui'
import { useAdminAuthStore } from '../store/admin-auth.store'
import type { AdminTab } from '../types'

const TABS: { id: AdminTab; label: string; icon: string }[] = [
  { id: 'inicio',         label: 'Inicio',        icon: '🏠' },
  { id: 'insumos',        label: 'Insumos',       icon: '📦' },
  { id: 'recetario',      label: 'Recetario',     icon: '📋' },
  { id: 'reportes',       label: 'Reportes',      icon: '📊' },
  { id: 'compras',        label: 'Compras',       icon: '🛒' },
  { id: 'configuracion',  label: 'Configuración', icon: '⚙️' },
]

interface AdminLayoutProps {
  activeTab: AdminTab
  onTabChange: (tab: AdminTab) => void
  children: React.ReactNode
}

export function AdminLayout({ activeTab, onTabChange, children }: AdminLayoutProps) {
  const { user, logout } = useAdminAuthStore()

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col">
      {/* Top navbar */}
      <header className="bg-primary text-white px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <span className="font-display text-lg font-bold tracking-wide">SAS Restaurantes</span>
          <span className="text-xs bg-secondary/80 px-2 py-0.5 rounded-full font-mono">Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-blue-200 hidden sm:block">{user?.name}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-white border-white/40 hover:bg-white/10"
          >
            Salir
          </Button>
        </div>
      </header>

      {/* Tab bar */}
      <nav
        className="bg-white border-b border-border shadow-sm overflow-x-auto"
        aria-label="Secciones del panel"
      >
        <div className="flex min-w-max px-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={[
                'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2',
                'transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2',
                'focus-visible:ring-secondary/50 focus-visible:ring-inset',
                activeTab === tab.id
                  ? 'border-secondary text-secondary'
                  : 'border-transparent text-muted hover:text-primary hover:border-border',
              ].join(' ')}
            >
              <span aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Page content */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {children}
      </main>
    </div>
  )
}
