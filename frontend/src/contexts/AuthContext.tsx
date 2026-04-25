import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import axios from 'axios'
import type { AuthUser } from '../api/auth'
import { loginUser, registerUser, logoutUser, fetchMe } from '../api/auth'
import { setAccessToken, setOnSessionExpired } from '../api/client'

interface AuthState {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, fullName: string, orgName: string) => Promise<void>
  /**
   * Tear down the session.
   * `silent: true` skips the POST /auth/logout call — used by the account-
   * deletion flow where the user row no longer exists and a server logout
   * would 401-bounce through the refresh interceptor.
   */
  logout: (opts?: { silent?: boolean }) => Promise<void>
  updateUser: (user: AuthUser) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Clear session state — used by both logout and interceptor callback
  const clearSession = useCallback(() => {
    setAccessToken(null)
    setUser(null)
  }, [])

  // Register the session-expired callback so the interceptor can trigger
  // a React-Router redirect (via user=null → ProtectedRoute) instead of
  // a hard window.location redirect.
  useEffect(() => {
    setOnSessionExpired(clearSession)
    return () => setOnSessionExpired(null)
  }, [clearSession])

  // Try to restore session on mount.
  // Uses a direct axios call to /auth/refresh (bypasses the api interceptor)
  // so we don't trigger the 401-refresh loop during the initial check.
  useEffect(() => {
    let cancelled = false

    async function restore() {
      try {
        // Step 1: attempt silent refresh via httpOnly cookie
        const res = await axios.post('/api/v1/auth/refresh', null, {
          withCredentials: true,
        })
        const newToken = res.data?.data?.access_token
        if (!newToken) throw new Error('No token')

        setAccessToken(newToken)

        // Step 2: fetch user profile with the fresh token
        const me = await fetchMe()
        if (!cancelled) setUser(me)
      } catch {
        // No valid refresh cookie — user is not authenticated
        setAccessToken(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    restore()
    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginUser({ email, password })
    setAccessToken(data.access_token)
    setUser(data.user)
  }, [])

  const register = useCallback(
    async (email: string, password: string, fullName: string, orgName: string) => {
      const data = await registerUser({
        email,
        password,
        full_name: fullName,
        organization_name: orgName,
      })
      setAccessToken(data.access_token)
      setUser(data.user)
    },
    [],
  )

  const logout = useCallback(async (opts?: { silent?: boolean }) => {
    if (opts?.silent) {
      clearSession()
      return
    }
    try {
      await logoutUser()
    } finally {
      clearSession()
    }
  }, [clearSession])

  const updateUser = useCallback((u: AuthUser) => {
    setUser(u)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
