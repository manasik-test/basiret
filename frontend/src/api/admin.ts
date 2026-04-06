import api from './client'

export interface AdminUser {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  organization_id: string
  organization_name: string | null
  created_at: string | null
}

export interface AdminFlag {
  id: string
  plan_tier: string
  feature_name: string
  is_enabled: boolean
}

interface ApiResponse<T> {
  success: boolean
  data: T
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const res = await api.get<unknown, ApiResponse<{ users: AdminUser[] }>>('/admin/users')
  return res.data.users
}

export async function updateAdminUser(
  userId: string,
  body: { role?: string; is_active?: boolean },
): Promise<void> {
  await api.patch(`/admin/users/${userId}`, body)
}

export async function fetchAdminFlags(): Promise<AdminFlag[]> {
  const res = await api.get<unknown, ApiResponse<{ flags: AdminFlag[] }>>('/admin/flags')
  return res.data.flags
}

export async function updateAdminFlag(flagId: string, is_enabled: boolean): Promise<void> {
  await api.patch(`/admin/flags/${flagId}`, { is_enabled })
}
