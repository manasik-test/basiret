import api from './client'

export interface AuthUser {
  id: string
  email: string
  full_name: string
  role: string
  organization_id: string
  organization_name: string
}

interface AuthResponse {
  success: boolean
  data: {
    access_token: string
    token_type: string
    user: AuthUser
  }
}

interface MeResponse {
  success: boolean
  data: AuthUser
}

export async function registerUser(body: {
  email: string
  password: string
  full_name: string
  organization_name: string
}): Promise<AuthResponse['data']> {
  const res = await api.post<unknown, AuthResponse>('/auth/register', body)
  return res.data
}

export async function loginUser(body: {
  email: string
  password: string
}): Promise<AuthResponse['data']> {
  const res = await api.post<unknown, AuthResponse>('/auth/login', body)
  return res.data
}

export async function refreshToken(): Promise<{ access_token: string }> {
  const res = await api.post<unknown, { success: boolean; data: { access_token: string } }>('/auth/refresh')
  return res.data
}

export async function logoutUser(): Promise<void> {
  await api.post('/auth/logout')
}

export async function fetchMe(): Promise<AuthUser> {
  const res = await api.get<unknown, MeResponse>('/auth/me')
  return res.data
}

export async function updateProfile(fullName: string): Promise<AuthUser> {
  const res = await api.patch<unknown, MeResponse>('/auth/profile', { full_name: fullName })
  return res.data
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  })
}

export async function deleteAccount(password: string): Promise<{ outcome: 'org_deleted' | 'user_only' }> {
  // Axios `delete` only sends a body when explicitly placed under `data`.
  const res = await api.delete<unknown, { success: boolean; data: { outcome: 'org_deleted' | 'user_only' } }>(
    '/auth/account',
    { data: { password } },
  )
  return res.data
}
