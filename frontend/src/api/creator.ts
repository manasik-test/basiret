/**
 * Post Creator API client.
 *
 * Mirrors the response envelope every other Basiret endpoint uses
 * (`{ success, data }`) and lets React Query unwrap with `.data`.
 */
import api from './client'

export type PostStatus =
  | 'draft'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled'

export type MediaType = 'image' | 'video' | 'carousel'

export type ImageRatio = '1:1' | '4:5' | '16:9'

export interface ScheduledPost {
  id: string
  organization_id: string
  social_account_id: string
  media_urls: string[]
  media_type: MediaType | null
  caption_ar: string | null
  caption_en: string | null
  hashtags: string[]
  ratio: ImageRatio | null
  scheduled_at: string | null
  published_at: string | null
  status: PostStatus
  platform_post_id: string | null
  ai_generated_media: boolean
  ai_generated_caption: boolean
  source_image_url: string | null
  content_plan_day: string | null
  draft_expires_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface UploadResponse {
  url: string
  media_type: MediaType
  filename: string
}

export interface CalendarResponse {
  // Keyed by ISO date (YYYY-MM-DD).
  [date: string]: { posts: ScheduledPost[] }
}

export interface CreatePostBody {
  social_account_id?: string
  media_urls: string[]
  media_type?: MediaType
  caption_ar?: string
  caption_en?: string
  hashtags?: string[]
  ratio?: ImageRatio
  scheduled_at?: string
  status: PostStatus
  content_plan_day?: string
  ai_generated_media?: boolean
  ai_generated_caption?: boolean
  source_image_url?: string
}

export interface UpdatePostBody {
  media_urls?: string[]
  media_type?: MediaType
  caption_ar?: string
  caption_en?: string
  hashtags?: string[]
  ratio?: ImageRatio
  scheduled_at?: string | null
  status?: PostStatus
}

export async function uploadMedia(file: File): Promise<UploadResponse> {
  const form = new FormData()
  form.append('file', file)
  // Don't set Content-Type — axios + the browser pick the right
  // `multipart/form-data; boundary=...` header automatically. Forcing
  // the bare type drops the boundary and the backend can't parse it.
  const res = await api.post<unknown, { success: boolean; data: UploadResponse }>(
    '/creator/upload',
    form,
  )
  return res.data
}

export async function createPost(body: CreatePostBody): Promise<ScheduledPost> {
  const res = await api.post<unknown, { success: boolean; data: ScheduledPost }>(
    '/creator/posts',
    body,
  )
  return res.data
}

export async function updatePost(
  id: string,
  body: UpdatePostBody,
): Promise<ScheduledPost> {
  const res = await api.put<unknown, { success: boolean; data: ScheduledPost }>(
    `/creator/posts/${id}`,
    body,
  )
  return res.data
}

export async function deletePost(id: string): Promise<void> {
  await api.delete(`/creator/posts/${id}`)
}

export async function fetchPosts(opts?: {
  status?: PostStatus
  account_id?: string
}): Promise<ScheduledPost[]> {
  const params = new URLSearchParams()
  if (opts?.status) params.set('status', opts.status)
  if (opts?.account_id) params.set('account_id', opts.account_id)
  const qs = params.toString()
  const res = await api.get<unknown, { success: boolean; data: ScheduledPost[] }>(
    `/creator/posts${qs ? `?${qs}` : ''}`,
  )
  return res.data
}

export async function fetchPost(id: string): Promise<ScheduledPost> {
  const res = await api.get<unknown, { success: boolean; data: ScheduledPost }>(
    `/creator/posts/${id}`,
  )
  return res.data
}

export async function fetchCalendar(opts: {
  month: string  // YYYY-MM
  account_id?: string
}): Promise<CalendarResponse> {
  const params = new URLSearchParams({ month: opts.month })
  if (opts.account_id) params.set('account_id', opts.account_id)
  const res = await api.get<unknown, { success: boolean; data: CalendarResponse }>(
    `/creator/calendar?${params.toString()}`,
  )
  return res.data
}
