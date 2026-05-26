import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { authRoutes } from './auth.routes'

// ── Mock del servicio ──────────────────────────────────────────────────────

vi.mock('./auth.service', () => ({
  authService: {
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
  },
}))

import { authService } from './auth.service'

// ── Helper: app de test ────────────────────────────────────────────────────

async function buildApp() {
  const app = Fastify({ logger: false })
  await app.register(authRoutes)
  return app
}

// ── Tests: POST /auth/login ────────────────────────────────────────────────

describe('POST /auth/login', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna 200 con tokens cuando las credenciales son válidas', async () => {
    const mockResponse = {
      accessToken: 'access.token.here',
      refreshToken: 'refresh.token.here',
      user: { id: 'u1', name: 'Admin', email: 'admin@sas.local', role: 'admin' },
    }
    vi.mocked(authService.login).mockResolvedValue(mockResponse)

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'admin@sas.local', password: 'admin123' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.accessToken).toBe('access.token.here')
    expect(body.refreshToken).toBe('refresh.token.here')
    expect(body.user.role).toBe('admin')
  })

  it('retorna 401 con credenciales inválidas', async () => {
    vi.mocked(authService.login).mockRejectedValue(
      Object.assign(new Error('Credenciales inválidas'), { statusCode: 401 })
    )

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'admin@sas.local', password: 'wrongpassword' },
    })

    expect(res.statusCode).toBe(401)
    expect(res.json().error).toBe('Credenciales inválidas')
  })

  it('retorna 400 si el email tiene formato inválido', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'not-an-email', password: 'admin123' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('Validation error')
    expect(authService.login).not.toHaveBeenCalled()
  })

  it('retorna 400 si falta el campo password', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'admin@sas.local' },
    })

    expect(res.statusCode).toBe(400)
    expect(authService.login).not.toHaveBeenCalled()
  })

  it('retorna 400 si el body está vacío', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {},
    })

    expect(res.statusCode).toBe(400)
  })
})

// ── Tests: POST /auth/refresh ──────────────────────────────────────────────

describe('POST /auth/refresh', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna 200 con nuevos tokens', async () => {
    const mockResponse = { accessToken: 'new.access', refreshToken: 'new.refresh' }
    vi.mocked(authService.refresh).mockResolvedValue(mockResponse)

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: 'old.refresh.token' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().accessToken).toBe('new.access')
    expect(res.json().refreshToken).toBe('new.refresh')
  })

  it('retorna 401 si el token está expirado o es inválido', async () => {
    vi.mocked(authService.refresh).mockRejectedValue(
      Object.assign(new Error('Refresh token inválido o expirado'), { statusCode: 401 })
    )

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: 'invalid.token' },
    })

    expect(res.statusCode).toBe(401)
  })

  it('retorna 400 si falta refreshToken en el body', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: {},
    })

    expect(res.statusCode).toBe(400)
    expect(authService.refresh).not.toHaveBeenCalled()
  })
})

// ── Tests: POST /auth/logout ───────────────────────────────────────────────

describe('POST /auth/logout', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retorna 204 y llama al servicio con el token', async () => {
    vi.mocked(authService.logout).mockResolvedValue(undefined)

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      payload: { refreshToken: 'some.refresh.token' },
    })

    expect(res.statusCode).toBe(204)
    expect(authService.logout).toHaveBeenCalledWith('some.refresh.token')
  })

  it('retorna 400 si falta refreshToken', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      payload: {},
    })

    expect(res.statusCode).toBe(400)
    expect(authService.logout).not.toHaveBeenCalled()
  })
})
