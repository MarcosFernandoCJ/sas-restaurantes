import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import jwt from 'jsonwebtoken'
import { requireRole } from './require-role'

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret'

// ── Helper: app con una ruta protegida ─────────────────────────────────────

async function buildProtectedApp(roles: ('admin' | 'waiter' | 'chef')[]) {
  const app = Fastify({ logger: false })
  app.get(
    '/protected',
    { preHandler: requireRole(roles) },
    async (request) => ({ user: request.user })
  )
  return app
}

function makeAccessToken(role: 'admin' | 'waiter' | 'chef', userId = 'u1'): string {
  return jwt.sign(
    { sub: userId, email: `${role}@sas.local`, role, type: 'access' },
    JWT_SECRET,
    { expiresIn: '15m' }
  )
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('requireRole middleware', () => {
  it('permite acceso con rol correcto y adjunta request.user', async () => {
    const token = makeAccessToken('admin')
    const app = await buildProtectedApp(['admin'])

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.user.role).toBe('admin')
    expect(body.user.sub).toBe('u1')
  })

  it('permite acceso cuando el rol está en la lista de roles permitidos', async () => {
    const token = makeAccessToken('waiter')
    const app = await buildProtectedApp(['admin', 'waiter'])

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
  })

  it('retorna 401 si no hay header Authorization', async () => {
    const app = await buildProtectedApp(['admin'])

    const res = await app.inject({ method: 'GET', url: '/protected' })

    expect(res.statusCode).toBe(401)
    expect(res.json().error).toBe('Unauthorized')
  })

  it('retorna 401 si el header no tiene el prefijo Bearer', async () => {
    const app = await buildProtectedApp(['admin'])

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    })

    expect(res.statusCode).toBe(401)
  })

  it('retorna 401 con un JWT firmado con secret incorrecto', async () => {
    const badToken = jwt.sign(
      { sub: 'u1', email: 'x@x.com', role: 'admin', type: 'access' },
      'wrong-secret',
      { expiresIn: '15m' }
    )
    const app = await buildProtectedApp(['admin'])

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { Authorization: `Bearer ${badToken}` },
    })

    expect(res.statusCode).toBe(401)
  })

  it('retorna 401 con un access token expirado', async () => {
    const expiredToken = jwt.sign(
      { sub: 'u1', email: 'admin@sas.local', role: 'admin', type: 'access' },
      JWT_SECRET,
      { expiresIn: -1 }
    )
    const app = await buildProtectedApp(['admin'])

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { Authorization: `Bearer ${expiredToken}` },
    })

    expect(res.statusCode).toBe(401)
    expect(res.json().message).toContain('inválido')
  })

  it('retorna 401 si se usa un refresh token en lugar de access token', async () => {
    const refreshToken = jwt.sign(
      { sub: 'u1', jti: 'x', type: 'refresh' },
      JWT_SECRET,
      { expiresIn: '8h' }
    )
    const app = await buildProtectedApp(['admin'])

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { Authorization: `Bearer ${refreshToken}` },
    })

    expect(res.statusCode).toBe(401)
    expect(res.json().message).toContain('incorrecto')
  })

  it('retorna 403 si el rol del usuario no está en la lista permitida', async () => {
    const token = makeAccessToken('chef')
    const app = await buildProtectedApp(['admin'])

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('Forbidden')
  })

  it('retorna 403 cuando un waiter intenta acceder a una ruta solo-admin', async () => {
    const token = makeAccessToken('waiter')
    const app = await buildProtectedApp(['admin'])

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(403)
  })
})
