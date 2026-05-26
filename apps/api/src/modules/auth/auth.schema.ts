import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email({ message: 'Email inválido' }),
  password: z.string().min(1, { message: 'Contraseña requerida' }),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, { message: 'refreshToken requerido' }),
})

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, { message: 'refreshToken requerido' }),
})

export type LoginBody = z.infer<typeof loginSchema>
export type RefreshBody = z.infer<typeof refreshSchema>
export type LogoutBody = z.infer<typeof logoutSchema>
