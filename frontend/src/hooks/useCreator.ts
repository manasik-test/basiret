import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  analyzeImage,
  createPost,
  deletePost,
  fetchCalendar,
  fetchPost,
  fetchPosts,
  generateImage,
  updatePost,
  uploadMedia,
  type CalendarResponse,
  type CreatePostBody,
  type GenerateImageRequest,
  type PostStatus,
  type ScheduledPost,
  type UpdatePostBody,
} from '../api/creator'

const ROOT_KEY = ['creator'] as const

export function usePosts(status?: PostStatus, accountId?: string) {
  return useQuery<ScheduledPost[]>({
    queryKey: [...ROOT_KEY, 'posts', status ?? 'all', accountId ?? 'all'],
    queryFn: () => fetchPosts({ status, account_id: accountId }),
    staleTime: 30_000,
  })
}

export function usePost(id: string | null | undefined) {
  return useQuery<ScheduledPost>({
    queryKey: [...ROOT_KEY, 'posts', 'one', id],
    queryFn: () => fetchPost(id as string),
    enabled: !!id,
  })
}

export function useCalendar(month: string, accountId?: string) {
  return useQuery<CalendarResponse>({
    queryKey: [...ROOT_KEY, 'calendar', month, accountId ?? 'all'],
    queryFn: () => fetchCalendar({ month, account_id: accountId }),
    staleTime: 30_000,
  })
}

export function useUploadMedia() {
  return useMutation({ mutationFn: (file: File) => uploadMedia(file) })
}

export function useCreatePost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreatePostBody) => createPost(body),
    onSuccess: () => {
      // Bust every creator query — calendar + lists by status.
      qc.invalidateQueries({ queryKey: ROOT_KEY })
    },
  })
}

export function useUpdatePost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdatePostBody }) =>
      updatePost(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ROOT_KEY })
    },
  })
}

export function useDeletePost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePost(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ROOT_KEY })
    },
  })
}

export function useAnalyzeImage() {
  return useMutation({ mutationFn: (imageUrl: string) => analyzeImage(imageUrl) })
}

export function useGenerateImage() {
  return useMutation({ mutationFn: (req: GenerateImageRequest) => generateImage(req) })
}
