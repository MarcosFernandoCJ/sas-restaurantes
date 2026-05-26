import { create } from 'zustand'
import type { AdminUser } from '../types'

const TOKEN_KEY = 'sas_admin_token'
const USER_KEY = 'sas_admin_user'

interface AdminAuthState {
  token: string | null
  user: AdminUser | null
  login: (token: string, user: AdminUser) => void
  logout: () => void
}

export const useAdminAuthStore = create<AdminAuthState>(() => {
  const storedToken = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
  const storedUser = typeof window !== 'undefined' ? localStorage.getItem(USER_KEY) : null

  return {
    token: storedToken,
    user: storedUser ? (JSON.parse(storedUser) as AdminUser) : null,

    login: (token, user) => {
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(USER_KEY, JSON.stringify(user))
      useAdminAuthStore.setState({ token, user })
    },

    logout: () => {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      useAdminAuthStore.setState({ token: null, user: null })
    },
  }
})
