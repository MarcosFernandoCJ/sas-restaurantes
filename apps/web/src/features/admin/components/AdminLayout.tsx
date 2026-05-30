import React from 'react'
import { Button } from '@sas/ui'
import { useAdminAuthStore } from '../store/admin-auth.store'
import type { AdminTab } from '../types'

const TABS: { id: AdminTab; label: string; icon: string }[] = [
  { id: 'inicio',        label: 'Inicio',        icon: '🏠' },
  { id: 'insumos',       label: 'Insumos',       icon: '📦' },
  { id: 'recetario',     label: 'Recetario',     icon: '📋' },
  { id: 'ventas',        label: 'Ventas',        icon: '💰' },
  { id: 'reportes',      label: 'Reportes',      icon: '📊' },
  { id: 'compras',       label: 'Compras',       icon: '🛒' },
  { id: 'configuracion', label: 'Configuración', icon: '⚙️' },
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
      {/* Top header */}
      <header className="bg-primary text-white px-6 py-3 flex items-center justify-between shadow-md z-10 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-display text-lg font-bold tracking-wide">SAS Restaurantes</span>
          <span className="text-xs bg-secondary/80 px-2 py-0.5 rounded-full font-mono">Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/70 hidden sm:block">{user?.name}</span>
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

      {/* Body: sidebar + content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Vertical sidebar */}
        <nav
          className="w-52 shrink-0 bg-white border-r border-border flex flex-col shadow-sm overflow-y-auto"
          aria-label="Secciones del panel"
        >
          <div className="flex-1 py-4 px-2 space-y-0.5">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50',
                    isActive
                      ? 'bg-secondary/10 text-secondary font-semibold'
                      : 'text-muted hover:text-primary hover:bg-surface',
                  ].join(' ')}
                >
                  <span className="text-base shrink-0" aria-hidden="true">{tab.icon}</span>
                  <span className="flex-1 truncate">{tab.label}</span>
                  {isActive && (
                    <span className="w-1.5 h-5 rounded-full bg-secondary shrink-0" aria-hidden="true" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Version footer */}
          <div className="px-4 py-3 border-t border-border">
            <p className="text-xs text-muted/60 font-mono">SAS v0.1</p>
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
