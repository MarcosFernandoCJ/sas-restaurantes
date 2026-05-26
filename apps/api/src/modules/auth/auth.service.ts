import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { authRepository } from './auth.repository'
import type { JwtPayload, LoginResponse, TokenPair } from './auth.types'
import type { LoginBody, RefreshBody } from './auth.schema'
import type { UserRole } from '@prisma/client'

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret'
const ACCESS_EXPIRES = '15m'
const REFRESH_EXPIRES = '8h'

function makeAuthError(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode })
}

function signAccessToken(sub: string, email: string, role: UserRole): string {
  const payload: Omit<JwtPayload, 'jti'> = { sub, email, role, type: 'access' }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES })
}

function signRefreshToken(sub: string, jti: string): string {
  const payload: JwtPayload = { sub, email: '', role: 'waiter', type: 'refresh', jti }
  return jwt.sign({ sub, jti, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_EXPIRES })
}

export const authService = {
  async login(body: LoginBody): Promise<LoginResponse> {
    const user = await authRepository.findUserByEmail(body.email)

    if (!user || !user.isActive) {
      throw makeAuthError('Credenciales inválidas', 401)
    }

    const passwordValid = await bcrypt.compare(body.password, user.passwordHash)
    if (!passwordValid) {
      throw makeAuthError('Credenciales inválidas', 401)
    }

    const jti = randomUUID()
    const accessToken = signAccessToken(user.id, user.email, user.role)
    const refreshToken = signRefreshToken(user.id, jti)

    await authRepository.saveRefreshToken(user.id, jti, refreshToken)

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    }
  },

  async refresh(body: RefreshBody): Promise<TokenPair> {
    let payload: JwtPayload
    try {
      payload = jwt.verify(body.refreshToken, JWT_SECRET) as JwtPayload
    } catch {
      throw makeAuthError('Refresh token inválido o expirado', 401)
    }

    if (payload.type !== 'refresh' || !payload.jti) {
      throw makeAuthError('Tipo de token inválido', 401)
    }

    const stored = await authRepository.getRefreshToken(payload.sub, payload.jti)
    if (!stored) {
      throw makeAuthError('Refresh token expirado o revocado', 401)
    }

    const user = await authRepository.findUserById(payload.sub)
    if (!user || !user.isActive) {
      await authRepository.deleteRefreshToken(payload.sub, payload.jti)
      throw makeAuthError('Usuario no encontrado o inactivo', 401)
    }

    // Rotación: eliminar el token anterior y emitir un par nuevo
    await authRepository.deleteRefreshToken(payload.sub, payload.jti)

    const newJti = randomUUID()
    const accessToken = signAccessToken(user.id, user.email, user.role)
    const refreshToken = signRefreshToken(user.id, newJti)

    await authRepository.saveRefreshToken(user.id, newJti, refreshToken)

    return { accessToken, refreshToken }
  },

  async logout(refreshToken: string): Promise<void> {
    let payload: JwtPayload
    try {
      payload = jwt.verify(refreshToken, JWT_SECRET) as JwtPayload
    } catch {
      // Token ya inválido/expirado — el cliente ya está efectivamente deslogueado
      return
    }

    if (payload.type === 'refresh' && payload.jti) {
      await authRepository.deleteRefreshToken(payload.sub, payload.jti)
    }
  },
}
