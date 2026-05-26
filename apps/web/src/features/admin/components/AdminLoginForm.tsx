import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@sas/ui'
import { useAdminAuthStore } from '../store/admin-auth.store'
import { adminApiPost } from '../hooks/useAdminApi'
import type { AdminUser } from '../types'

interface LoginResponse {
  accessToken: string
  user: AdminUser
}

export function AdminLoginForm() {
  const { login } = useAdminAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await adminApiPost<LoginResponse>('/auth/login', { email, password })
      if (res.user.role !== 'admin') {
        setError('Acceso denegado: se requiere rol de administrador.')
        return
      }
      login(res.accessToken, res.user)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error de autenticación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-primary">SAS Restaurantes</h1>
          <p className="text-muted text-sm mt-1">Panel de Administrador</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-border shadow-sm p-8 space-y-5"
        >
          <div className="space-y-1.5">
            <label htmlFor="admin-email" className="block text-sm font-medium text-primary">
              Correo electrónico
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="admin@restaurante.com"
              className={[
                'w-full rounded-lg border border-border bg-[#FAFAF8] px-3 py-2.5',
                'text-sm text-primary placeholder:text-muted',
                'focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary',
                'transition-colors',
              ].join(' ')}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="admin-password" className="block text-sm font-medium text-primary">
              Contraseña
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className={[
                'w-full rounded-lg border border-border bg-[#FAFAF8] px-3 py-2.5',
                'text-sm text-primary placeholder:text-muted',
                'focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary',
                'transition-colors',
              ].join(' ')}
            />
          </div>

          {error && (
            <p
              role="alert"
              className="text-sm text-state-danger bg-red-50 border border-red-200 rounded-lg px-3 py-2"
            >
              {error}
            </p>
          )}

          <Button variant="primary" size="lg" loading={loading} className="w-full">
            Ingresar al panel
          </Button>
        </form>
      </div>
    </div>
  )
}
