import { prisma } from '../../lib/prisma'
import { redis } from '../../lib/redis'

const REFRESH_TTL_SECONDS = 8 * 60 * 60 // 8 horas

export const authRepository = {
  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        role: true,
        isActive: true,
      },
    })
  },

  async findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    })
  },

  async saveRefreshToken(userId: string, tokenId: string, token: string): Promise<void> {
    await redis.set(`refresh:${userId}:${tokenId}`, token, 'EX', REFRESH_TTL_SECONDS)
  },

  async getRefreshToken(userId: string, tokenId: string): Promise<string | null> {
    return redis.get(`refresh:${userId}:${tokenId}`)
  },

  async deleteRefreshToken(userId: string, tokenId: string): Promise<void> {
    await redis.del(`refresh:${userId}:${tokenId}`)
  },
}
