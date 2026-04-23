import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// ── Token management (in-memory, not localStorage) ─────────
let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

// ── Logout callback (set by AuthContext to avoid circular imports) ──
let onSessionExpired: (() => void) | null = null

export function setOnSessionExpired(cb: (() => void) | null) {
  onSessionExpired = cb
}

// ── Request interceptor: attach Bearer token ───────────────
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

// ── Response interceptor: auto-refresh on 401 ──────────────
let isRefreshing = false
let pendingRequests: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

api.interceptors.response.use(
  (res) => res.data,
  async (err) => {
    const original = err.config

    // If 401 and not already retrying, attempt token refresh
    if (err.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          pendingRequests.push({
            resolve: (token: string) => {
              original.headers.Authorization = `Bearer ${token}`
              resolve(api.request(original))
            },
            reject,
          })
        })
      }

      original._retry = true
      isRefreshing = true

      try {
        const res = await axios.post('/api/v1/auth/refresh', null, { withCredentials: true })
        const newToken = res.data.data.access_token
        setAccessToken(newToken)

        // Resolve all queued requests with the new token
        pendingRequests.forEach((p) => p.resolve(newToken))
        pendingRequests = []

        original.headers.Authorization = `Bearer ${newToken}`
        return api.request(original)
      } catch (refreshErr) {
        setAccessToken(null)

        // Reject all queued requests so they don't hang
        pendingRequests.forEach((p) => p.reject(refreshErr))
        pendingRequests = []

        // Notify AuthContext to clear user state (triggers React Router redirect)
        if (onSessionExpired) onSessionExpired()

        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }

    const detail = err.response?.data?.detail
    const meta = err.response?.data?.meta
    let message: string
    if (Array.isArray(detail)) {
      // FastAPI/Pydantic validation errors: [{loc, msg, type}, ...]
      message = detail.map((d: { msg: string }) => d.msg).join('. ')
    } else if (typeof detail === 'string') {
      message = detail
    } else if (detail && typeof detail === 'object' && 'message' in detail) {
      // Structured error: {message: "...", locked: true, ...}
      message = String(detail.message)
    } else if (meta && typeof meta === 'object' && 'message' in meta) {
      // AI-degradation envelope: {success:false, data:null, meta:{status, message, ...}}
      message = String(meta.message)
    } else {
      message = err.response?.data?.error || err.message || 'Request failed'
    }
    return Promise.reject(new Error(message))
  },
)

export default api
