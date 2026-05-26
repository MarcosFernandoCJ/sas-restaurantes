import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { authService } from './auth.service'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('./auth.repository', () => ({
  authRepository: {
    findUserByEmail: vi.fn(),
    findUserById: vi.fn(),
    saveRefreshToken: vi.fn(),
    getRefreshToken: vi.fn(),
    deleteRefreshToken: vi.fn(),
  },
}))

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}))

import { authRepository } from './auth.repository'

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret'

const MOCK_USER = {
  id: 'user-uuid-1',
  name: 'Admin Principal',
  email: 'admin@sas.local',
  passwordHash: '$2b$12$hashedpassword',
  role: 'admin' as const,
  isActive: true,
}

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRefreshToken(userId: string, jti: string): string {
  return jwt.sign({ sub: userId, jti, type: 'refresh' }, JWT_SECRET, { expiresIn: '8h' })
}

// ── Tests: authService.login ────────────────────────────────────────────────

describe('authService.login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna accessToken, refreshToken y datos del usuario con credenciales válidas', async () => {
    vi.mocked(authRepository.findUserByEmail).mockResolvedValue(MOCK_USER)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
    vi.mocked(authRepository.saveRefreshToken).mockResolvedValue(undefined)

    const result = await authService.login({ email: 'admin@sas.local', password: 'admin123' })

    expect(result.accessToken).toBeTruthy()
    expect(result.refreshToken).toBeTruthy()
    expect(result.user).toEqual({
      id: MOCK_USER.id,
      name: MOCK_USER.name,
      email: MOCK_USER.email,
      role: MOCK_USER.role,
    })

    // El access token debe tener el payload correcto
    const decoded = jwt.verify(result.accessToken, JWT_SECRET) as Record<string, unknown>
    expect(decoded.sub).toBe(MOCK_USER.id)
    expect(decoded.role).toBe('admin')
    expect(decoded.type).toBe('access')

    // Debe guardar el refresh token en Redis
    expect(authRepository.saveRefreshToken).toHaveBeenCalledOnce()
  })

  it('lanza 401 si el usuario no existe', async () => {
    vi.mocked(authRepository.findUserByEmail).mockResolvedValue(null)

    await expect(
      authService.login({ email: 'noexiste@sas.local', password: 'cualquier' })
    ).rejects.toMatchObject({ message: 'Credenciales inválidas', statusCode: 401 })
  })

  it('lanza 401 si el usuario está inactivo', async () => {
    vi.mocked(authRepository.findUserByEmail).mockResolvedValue({ ...MOCK_USER, isActive: false })

    await expect(
      authService.login({ email: 'admin@sas.local', password: 'admin123' })
    ).rejects.toMatchObject({ statusCode: 401 })
  })

  it('lanza 401 si la contraseña es incorrecta', async () => {
    vi.mocked(authRepository.findUserByEmail).mockResolvedValue(MOCK_USER)
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

    await expect(
      authService.login({ email: 'admin@sas.local', password: 'wrongpassword' })
    ).rejects.toMatchObject({ message: 'Credenciales inválidas', statusCode: 401 })
  })

  it('no llama a saveRefreshToken si las credenciales son inválidas', async () => {
    vi.mocked(authRepository.findUserByEmail).mockResolvedValue(null)

    await expect(authService.login({ email: 'x@x.com', password: 'x' })).rejects.toThrow()
    expect(authRepository.saveRefreshToken).not.toHaveBeenCalled()
  })
})

// ── Tests: authService.refresh ──────────────────────────────────────────────

describe('authService.refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rota el token correctamente y devuelve un par nuevo', async () => {
    const jti = 'old-jti-uuid'
    const refreshToken = makeRefreshToken(MOCK_USER.id, jti)

    vi.mocked(authRepository.getRefreshToken).mockResolvedValue(refreshToken)
    vi.mocked(authRepository.deleteRefreshToken).mockResolvedValue(undefined)
    vi.mocked(authRepository.saveRefreshToken).mockResolvedValue(undefined)
    vi.mocked(authRepository.findUserById).mockResolvedValue({
      id: MOCK_USER.id,
      name: MOCK_USER.name,
      email: MOCK_USER.email,
      role: MOCK_USER.role,
      isActive: true,
    })

    const result = await authService.refresh({ refreshToken })

    expect(result.accessToken).toBeTruthy()
    expect(result.refreshToken).toBeTruthy()
    // El token rotado debe ser distinto al original
    expect(result.refreshToken).not.toBe(refreshToken)

    expect(authRepository.deleteRefreshToken).toHaveBeenCalledWith(MOCK_USER.id, jti)
    expect(authRepository.saveRefreshToken).toHaveBeenCalledOnce()
  })

  it('lanza 401 con un JWT inválido (firmado con otro secret)', async () => {
    const bogusToken = jwt.sign({ sub: 'x', jti: 'x', type: 'refresh' }, 'wrong-secret')

    await expect(authService.refresh({ refreshToken: bogusToken })).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('lanza 401 si el token no está en Redis (revocado)', async () => {
    const jti = 'revoked-jti'
    const refreshToken = makeRefreshToken(MOCK_USER.id, jti)

    vi.mocked(authRepository.getRefreshToken).mockResolvedValue(null)

    await expect(authService.refresh({ refreshToken })).rejects.toMatchObject({ statusCode: 401 })
    expect(authRepository.deleteRefreshToken).not.toHaveBeenCalled()
  })

  it('lanza 401 si el usuario fue desactivado después de emitir el token', async () => {
    const jti = 'active-jti'
    const refreshToken = makeRefreshToken(MOCK_USER.id, jti)

    vi.mocked(authRepository.getRefreshToken).mockResolvedValue(refreshToken)
    vi.mocked(authRepository.findUserById).mockResolvedValue(null)
    vi.mocked(authRepository.deleteRefreshToken).mockResolvedValue(undefined)

    await expect(authService.refresh({ refreshToken })).rejects.toMatchObject({ statusCode: 401 })
    // Debe limpiar el token de Redis aunque el usuario ya no exista
    expect(authRepository.deleteRefreshToken).toHaveBeenCalledWith(MOCK_USER.id, jti)
  })
})

// ── Tests: authService.logout ───────────────────────────────────────────────

describe('authService.logout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('elimina el refresh token de Redis', async () => {
    const jti = 'valid-jti'
    const refreshToken = makeRefreshToken(MOCK_USER.id, jti)
    vi.mocked(authRepository.deleteRefreshToken).mockResolvedValue(undefined)

    await authService.logout(refreshToken)

    expect(authRepository.deleteRefreshToken).toHaveBeenCalledWith(MOCK_USER.id, jti)
  })

  it('no lanza error si el token ya expiró (logout silencioso)', async () => {
    const expiredToken = jwt.sign(
      { sub: MOCK_USER.id, jti: 'x', type: 'refresh' },
      JWT_SECRET,
      { expiresIn: -1 }
    )

    await expect(authService.logout(expiredToken)).resolves.toBeUndefined()
    expect(authRepository.deleteRefreshToken).not.toHaveBeenCalled()
  })

  it('no lanza error con un token completamente inválido', async () => {
    await expect(authService.logout('not.a.valid.jwt')).resolves.toBeUndefined()
  })
})
