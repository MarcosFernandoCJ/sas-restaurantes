import React, { useState, useRef } from 'react'
import { Button, Spinner } from '@sas/ui'
import { useWaiterAuthStore } from '../store/waiter-auth.store'
import { apiPost, ApiError } from '../hooks/useApi'

interface LoginResponse {
  accessToken: string
  user: { id: string; name: string; email: string; role: string }
}

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pinRef = useRef<HTMLInputElement>(null)
  const login = useWaiterAuthStore((s) => s.login)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !pin.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await apiPost<LoginResponse>('/auth/login', { email: email.trim(), password: pin })
      login(res.accessToken, res.user)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.statusCode === 401 ? 'Email o PIN incorrecto' : err.message)
      } else {
        setError('No se pudo conectar con el servidor')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl font-bold text-primary">SAS Restaurantes</h1>
          <p className="font-body text-muted mt-2 text-sm">Sistema de Gestión · Mesero</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-primary mb-1.5">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && pinRef.current?.focus()}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-primary font-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-secondary"
              placeholder="tu@email.com"
              required
            />
          </div>

          <div>
            <label htmlFor="pin" className="block text-sm font-semibold text-primary mb-1.5">
              Contraseña / PIN
            </label>
            <input
              id="pin"
              ref={pinRef}
              type="password"
              autoComplete="current-password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-primary font-body tracking-widest placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-secondary"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 font-body">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            disabled={!email || !pin}
            className="w-full"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </Button>

          <p className="text-xs text-center text-muted font-mono">
            Demo: carlos@sas.local / waiter123
          </p>
        </form>
      </div>
    </div>
  )
}