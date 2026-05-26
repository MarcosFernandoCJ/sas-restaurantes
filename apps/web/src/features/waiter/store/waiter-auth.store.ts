import { create } from 'zustand'
import type { WaiterUser } from '../types'

const TOKEN_KEY = 'sas_waiter_token'
const USER_KEY = 'sas_waiter_user'

interface WaiterAuthState {
  token: string | null
  user: WaiterUser | null
  login: (token: string, user: WaiterUser) => void
  logout: () => void
}

export const useWaiterAuthStore = create<WaiterAuthState>(() => {
  const storedToken = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
  const storedUser = typeof window !== 'undefined' ? localStorage.getItem(USER_KEY) : null

  return {
    token: storedToken,
    user: storedUser ? (JSON.parse(storedUser) as WaiterUser) : null,

    login: (token, user) => {
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(USER_KEY, JSON.stringify(user))
      useWaiterAuthStore.setState({ token, user })
    },

    logout: () => {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      useWaiterAuthStore.setState({ token: null, user: null })
    },
  }
})