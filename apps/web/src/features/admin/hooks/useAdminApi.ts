import { useAdminAuthStore } from '../store/admin-auth.store'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export class AdminApiError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message)
    this.name = 'AdminApiError'
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new AdminApiError(
      body.error ?? body.message ?? `Error ${res.status}`,
      res.status
    )
  }
  return res.json() as Promise<T>
}

export function useAdminApi() {
  const token = useAdminAuthStore((s) => s.token)

  return {
    get: <T>(path: string) => request<T>(path, { method: 'GET' }, token),
    post: <T>(path: string, body?: unknown) =>
      request<T>(path, { method: 'POST', body: JSON.stringify(body) }, token),
    patch: <T>(path: string, body?: unknown) =>
      request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, token),
  }
}

// Used for login (no token yet)
export function adminApiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) }, null)
}
