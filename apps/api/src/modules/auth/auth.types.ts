import type { UserRole } from '@prisma/client'

export interface JwtPayload {
  sub: string
  email: string
  role: UserRole
  type: 'access' | 'refresh'
  jti?: string
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export interface LoginResponse extends TokenPair {
  user: AuthUser
}
