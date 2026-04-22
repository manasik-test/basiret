import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchOverview, fetchSentiment, fetchSentimentTimeline, fetchPostsBreakdown,
  fetchAccounts, fetchSegments, regenerateSegments, fetchInsights, generateInsights,
  fetchCommentsAnalytics, fetchSentimentSummary,
  fetchPostsInsights, generateCaption, fetchAudienceInsights, fetchContentPlan, fetchSentimentResponses,
  type GenerateCaptionRequest,
} from '../api/analytics'

export function useOverview() {
  return useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: fetchOverview,
    staleTime: 60_000,
  })
}

export function useSentiment() {
  return useQuery({
    queryKey: ['analytics', 'sentiment'],
    queryFn: fetchSentiment,
    staleTime: 60_000,
  })
}

export function useAccounts() {
  return useQuery({
    queryKey: ['analytics', 'accounts'],
    queryFn: fetchAccounts,
    staleTime: 60_000,
  })
}

export function useSegments() {
  const accounts = useAccounts()
  const firstAccountId = accounts.data?.[0]?.id

  return useQuery({
    queryKey: ['analytics', 'segments', firstAccountId],
    queryFn: () => fetchSegments(firstAccountId!),
    enabled: !!firstAccountId,
    staleTime: 60_000,
  })
}

export function usePostsBreakdown() {
  return useQuery({
    queryKey: ['analytics', 'posts-breakdown'],
    queryFn: fetchPostsBreakdown,
    staleTime: 60_000,
  })
}

export function useSentimentTimeline() {
  return useQuery({
    queryKey: ['analytics', 'sentiment-timeline'],
    queryFn: fetchSentimentTimeline,
    staleTime: 60_000,
  })
}

export function useRegenerateSegments() {
  const queryClient = useQueryClient()
  const accounts = useAccounts()
  const firstAccountId = accounts.data?.[0]?.id

  return useMutation({
    mutationFn: () => regenerateSegments(firstAccountId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics', 'segments'] })
    },
  })
}

export function useInsights() {
  return useQuery({
    queryKey: ['analytics', 'insights'],
    queryFn: fetchInsights,
    staleTime: 60_000,
  })
}

export function useGenerateInsights() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: generateInsights,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics', 'insights'] })
    },
  })
}

export function useCommentsAnalytics(accountId?: string) {
  return useQuery({
    queryKey: ['analytics', 'comments', accountId ?? 'all'],
    queryFn: () => fetchCommentsAnalytics(accountId),
    staleTime: 60_000,
  })
}

export function useSentimentSummary(accountId?: string) {
  return useQuery({
    queryKey: ['analytics', 'sentiment-summary', accountId ?? 'all'],
    queryFn: () => fetchSentimentSummary(accountId),
    staleTime: 5 * 60_000,
  })
}

// AI page-level hooks (longer staleTime since each call hits Gemini)

export function usePostsInsights() {
  return useQuery({
    queryKey: ['ai-pages', 'posts-insights'],
    queryFn: fetchPostsInsights,
    staleTime: 5 * 60_000,
  })
}

export function useGenerateCaption() {
  return useMutation({
    mutationFn: (req: GenerateCaptionRequest) => generateCaption(req),
  })
}

export function useAudienceInsights() {
  return useQuery({
    queryKey: ['ai-pages', 'audience-insights'],
    queryFn: fetchAudienceInsights,
    staleTime: 5 * 60_000,
  })
}

export function useContentPlan() {
  return useQuery({
    queryKey: ['ai-pages', 'content-plan'],
    queryFn: fetchContentPlan,
    staleTime: 5 * 60_000,
  })
}

export function useSentimentResponses() {
  return useQuery({
    queryKey: ['ai-pages', 'sentiment-responses'],
    queryFn: fetchSentimentResponses,
    staleTime: 5 * 60_000,
  })
}
