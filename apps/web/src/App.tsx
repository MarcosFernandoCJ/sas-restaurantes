import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Button, Badge, Card, Spinner } from '@sas/ui'
import type { BadgeVariant } from '@sas/ui'
import { KitchenPage } from '@/pages/KitchenPage'
import { BarPage } from '@/pages/BarPage'
import { WaiterPage } from '@/pages/WaiterPage'
import { AdminDashboardPage } from '@/pages/AdminDashboardPage'
import { LoginForm } from '@/features/waiter/components/LoginForm'
import { useWaiterAuthStore } from '@/features/waiter/store/waiter-auth.store'

const ORDER_BADGE_VARIANTS: { variant: BadgeVariant; label: string }[] = [
  { variant: 'pending',    label: 'Sin empezar' },
  { variant: 'in_prep',   label: 'En preparación' },
  { variant: 'ready',     label: 'Listo' },
  { variant: 'additional', label: 'Adicional' },
  { variant: 'delivery',  label: 'Delivery' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-semibold text-primary border-b border-border pb-2">
        {title}
      </h2>
      {children}
    </section>
  )
}

function DesignSystemDemo() {
  const [loadingBtn, setLoadingBtn] = useState(false)

  const handleLoadingDemo = () => {
    setLoadingBtn(true)
    setTimeout(() => setLoadingBtn(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] py-10 px-6">
      <div className="max-w-3xl mx-auto space-y-12">

        {/* Header */}
        <header className="text-center space-y-1">
          <h1 className="font-display text-4xl font-bold text-primary">
            SAS Restaurantes
          </h1>
          <p className="font-mono text-sm text-muted">
            Design System · Sesión 1.3 · Paleta "Brasas & Carbón"
          </p>
          <div className="flex justify-center gap-4 text-sm text-muted mt-2">
            <a href="/kitchen" className="underline text-secondary">→ Cocina</a>
            <a href="/bar" className="underline text-secondary">→ Bar</a>
            <a href="/waiter" className="underline text-secondary">→ Mesero</a>
            <a href="/admin/dashboard" className="underline text-secondary">→ Admin</a>
          </div>
        </header>

        {/* Buttons */}
        <Section title="Button — variantes">
          <div className="flex flex-wrap gap-3 items-center">
            <Button variant="primary">Confirmar pedido</Button>
            <Button variant="secondary">Tomar ítem</Button>
            <Button variant="ghost">Ver detalle</Button>
            <Button variant="danger">Cancelar</Button>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <Button variant="primary" size="sm">Pequeño</Button>
            <Button variant="primary" size="md">Mediano</Button>
            <Button variant="primary" size="lg">Grande</Button>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <Button variant="primary" loading={loadingBtn} onClick={handleLoadingDemo}>
              {loadingBtn ? 'Procesando...' : 'Demo loading (2s)'}
            </Button>
            <Button variant="primary" disabled>Deshabilitado</Button>
          </div>
        </Section>

        {/* Badges */}
        <Section title="Badge — estados de pedido">
          <div className="flex flex-wrap gap-3 items-center">
            {ORDER_BADGE_VARIANTS.map(({ variant, label }) => (
              <Badge key={variant} variant={variant}>{label}</Badge>
            ))}
          </div>
        </Section>

        {/* Card */}
        <Section title="Card">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card
              header="Pedido #42 — Mesa 7"
              footer={<Badge variant="in_prep">En preparación</Badge>}
            >
              <ul className="space-y-1 text-sm text-primary">
                <li>🍗 Pollo a la brasa × 2</li>
                <li>🥤 Inca Kola × 2 <span className="text-muted">— sin hielo</span></li>
              </ul>
            </Card>

            <Card header="Pedido #43 — Delivery">
              <p className="text-sm text-muted mb-3">Cliente: Juan Pérez</p>
              <Badge variant="delivery">Delivery</Badge>
            </Card>

            <Card>
              <p className="text-sm text-primary">Card sin header ni footer</p>
            </Card>
          </div>
        </Section>

        {/* Spinner */}
        <Section title="Spinner — tamaños">
          <div className="flex gap-6 items-center">
            <Spinner size="sm" label="Cargando (sm)" />
            <Spinner size="md" label="Cargando (md)" />
            <Spinner size="lg" label="Cargando (lg)" />
          </div>
        </Section>

        {/* Color palette */}
        <Section title="Paleta de colores">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            {[
              { name: 'primary',    bg: 'bg-primary',    label: '#1B2B3A' },
              { name: 'secondary',  bg: 'bg-secondary',  label: '#C8410A' },
              { name: 'accent',     bg: 'bg-accent',     label: '#E8A838' },
              { name: 'surface',    bg: 'bg-surface border border-border', label: '#F0EDE8' },
              { name: 'pending',    bg: 'bg-state-pending',    label: '#B0C4D8' },
              { name: 'in-prep',    bg: 'bg-state-in-prep',    label: '#2563A8' },
              { name: 'ready',      bg: 'bg-state-ready',      label: '#1A6B3C' },
              { name: 'additional', bg: 'bg-state-additional', label: '#A05A2C' },
            ].map(({ name, bg, label }) => (
              <div key={name} className="space-y-1">
                <div className={['h-10 rounded-md', bg].join(' ')} />
                <p className="text-muted">{name}</p>
                <p className="text-primary">{label}</p>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </div>
  )
}

function WaiterRoute() {
  const token = useWaiterAuthStore((s) => s.token)
  return token ? <WaiterPage /> : <LoginForm />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DesignSystemDemo />} />
        <Route path="/kitchen" element={<KitchenPage />} />
        <Route path="/bar" element={<BarPage />} />
        <Route path="/waiter" element={<WaiterRoute />} />
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}