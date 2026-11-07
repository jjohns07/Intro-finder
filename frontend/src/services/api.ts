// One session and API origin for auth, discovery and history. The default keeps
// the existing Render deployment; the optional override supports local testing.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://intro-finder-api.onrender.com/api').replace(/\/$/, '')
const TOKEN_STORAGE_KEY = 'introfinder_token'
export const getStoredToken = (): string | null => sessionStorage.getItem(TOKEN_STORAGE_KEY)
export const setStoredToken = (token: string): void => { sessionStorage.setItem(TOKEN_STORAGE_KEY, token) }
export const clearStoredToken = (): void => { sessionStorage.removeItem(TOKEN_STORAGE_KEY) }
export function getAuthHeaders(tokenOverride?: string | null): Record<string, string> {
  const token = tokenOverride ?? getStoredToken()
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

export class ApiError extends Error {
  readonly status: number
  readonly data?: unknown
  constructor(message: string, status: number, data?: unknown) { super(message); this.name = 'ApiError'; this.status = status; this.data = data }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const abort = () => controller.abort(options.signal?.reason)
  if (options.signal?.aborted) abort()
  options.signal?.addEventListener('abort', abort, { once: true })
  const timeout = window.setTimeout(() => controller.abort(new DOMException('The request took too long. Please try again.', 'TimeoutError')), 20_000)
  try {
    const headers = new Headers(getAuthHeaders())
    new Headers(options.headers).forEach((value, key) => headers.set(key, value))
    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, signal: controller.signal, cache: 'no-store' })
    if (response.status === 204) return undefined as T
    const data = await response.json().catch(() => null)
    if (!response.ok) throw new ApiError(response.status === 401 ? 'Your session has expired. Please sign out and log in again.' : data?.message || 'The request could not be completed. Please try again.', response.status, data)
    if (data === null) throw new ApiError('The server returned an invalid response.', 502)
    return data as T
  } finally { window.clearTimeout(timeout); options.signal?.removeEventListener('abort', abort) }
}
