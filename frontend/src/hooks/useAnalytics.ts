import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchOverview, fetchSentiment, fetchSentimentTimeline, fetchPostsBreakdown, fetchAccounts, fetchSegments, regenerateSegments, fetchInsights, generateInsights, fetchCommentsAnalytics, fetchSentimentSummary } from '../api/analytics'

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
