import api from './client'

export type BusinessCategory =
  | 'restaurant_cafe'
  | 'fashion_clothing'
  | 'beauty_salon'
  | 'fitness_gym'
  | 'real_estate'
  | 'retail_shop'
  | 'services'
  | 'other'

export type BusinessCountry =
  | 'AE'
  | 'SA'
  | 'EG'
  | 'JO'
  | 'KW'
  | 'QA'
  | 'BH'
  | 'OM'
  | 'TR'
  | 'SD'
  | 'OTHER'

export type AudienceLanguage = 'ar' | 'en' | 'both'

export interface BusinessProfile {
  category: BusinessCategory
  city: string
  country: BusinessCountry
  audience_language: AudienceLanguage
}

export interface AuthUser {
  id: string
  email: string
  full_name: string
  role: string
  organization_id: string
  organization_name: string
  business_profile?: BusinessProfile | null
  // "Generate all 7 posts" remember-my-choice preference. When remember is
  // true AND default_action is set, the Content Plan page skips the
  // confirmation dialog and goes straight to a batch run with the saved
  // action.
  batch_generate_default_action?: 'drafts' | 'schedule' | null
  batch_generate_remember?: boolean
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

export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email })
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await api.post('/auth/reset-password', { token, new_password: newPassword })
}

export async function saveBusinessProfile(profile: BusinessProfile): Promise<BusinessProfile> {
  const res = await api.put<unknown, { success: boolean; data: BusinessProfile }>(
    '/auth/business-profile',
    profile,
  )
  return res.data
}

// ── Brand identity ──────────────────────────────────────────

export type BrandTone = 'professional' | 'friendly' | 'luxurious' | 'playful' | 'inspiring'
export type BrandLanguageStyle = 'formal_arabic' | 'casual_dialect' | 'bilingual'
export type BrandEmojiUsage = 'never' | 'occasionally' | 'frequently'
export type BrandCaptionLength = 'short' | 'medium' | 'long'
export type BrandImageStyle = 'clean' | 'vibrant' | 'minimal' | 'luxurious' | 'playful'

export interface BrandIdentity {
  primary_color: string
  secondary_color: string
  tone: BrandTone
  language_style: BrandLanguageStyle
  emoji_usage: BrandEmojiUsage
  caption_length: BrandCaptionLength
  content_pillars: string[]
  image_style: BrandImageStyle
  detected_from_posts: boolean
}

export interface DetectedBrandIdentity extends BrandIdentity {
  // The detect endpoint annotates the source so the UI can render the
  // appropriate "we got this from X" hint above the preview.
  source: 'captions' | 'category' | 'fallback'
}

export async function fetchBrandIdentity(): Promise<BrandIdentity> {
  const res = await api.get<unknown, { success: boolean; data: BrandIdentity }>(
    '/auth/brand-identity',
  )
  return res.data
}

export async function saveBrandIdentity(payload: BrandIdentity): Promise<BrandIdentity> {
  const res = await api.put<unknown, { success: boolean; data: BrandIdentity }>(
    '/auth/brand-identity',
    payload,
  )
  return res.data
}

export async function detectBrandIdentity(): Promise<DetectedBrandIdentity> {
  const res = await api.post<unknown, { success: boolean; data: DetectedBrandIdentity }>(
    '/auth/brand-identity/detect',
  )
  return res.data
}

export async function deleteAccount(password: string): Promise<{ outcome: 'org_deleted' | 'user_only' }> {
  // Axios `delete` only sends a body when explicitly placed under `data`.
  const res = await api.delete<unknown, { success: boolean; data: { outcome: 'org_deleted' | 'user_only' } }>(
    '/auth/account',
    { data: { password } },
  )
  return res.data
}
