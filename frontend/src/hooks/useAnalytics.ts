import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  fetchOverview, fetchSentiment, fetchSentimentTimeline, fetchPostsBreakdown,
  fetchTopPosts, fetchHashtagPerformance,
  fetchAccounts, fetchSegments, regenerateSegments, fetchInsights, generateInsights,
  fetchCommentsAnalytics, fetchSentimentSummary,
  fetchPostsInsights, generateCaption, fetchAudienceInsights, fetchContentPlan, fetchSentimentResponses,
  fetchRecommendationFeedback, submitRecommendationFeedback,
  fetchEngagementTimeline,
  fetchCompetitorLeaderboard, fetchCompetitorTopPosts, fetchHashtagTrends,
  updateContentPlanTopic, regenerateContentPlan,
  startBatchGenerate, fetchBatchProgress, fetchLatestBatchProgress,
  type GenerateCaptionRequest, type RecFeedback,
  type UpdateContentPlanTopicRequest,
  type StartBatchGenerateRequest,
} from '../api/analytics'

// Resolve the UI language to the two values our backend accepts (en|ar).
// `react-i18next` hands us strings like "en", "en-US", "ar", "ar-SA", etc.
function useUiLanguage(): 'en' | 'ar' {
  const { i18n } = useTranslation()
  return i18n.language?.startsWith('ar') ? 'ar' : 'en'
}

// Mount once at the app root. On every language switch (Sidebar/TopBar/Landing
// toggle), wipes the sessionStorage caption cache and invalidates every
// React Query entry that could return Gemini-produced text. Covers both
// language-keyed hooks (ai-pages/*, sentiment-summary — defensive only, since
// their queryKeys already differ per lang) and hooks whose queryKeys lack
// `lang` but whose backend data is still localized (insights, segments'
// persona_description). Without this, a user switching EN→AR sees the cached
// English Gemini text from those latter hooks until their staleTime elapses.
export function useLanguageCacheInvalidation() {
  const { i18n } = useTranslation()
  const queryClient = useQueryClient()
  const prevLang = useRef(i18n.language)

  useEffect(() => {
    const onLanguageChange = (lng: string) => {
      if (lng === prevLang.current) return
      prevLang.current = lng

      try {
        const toRemove: string[] = []
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const k = window.sessionStorage.key(i)
          if (k?.startsWith('basiret:caption:')) toRemove.push(k)
        }
        toRemove.forEach((k) => window.sessionStorage.removeItem(k))
      } catch {
        // sessionStorage may be blocked (private mode). Nothing to invalidate.
      }

      queryClient.invalidateQueries({ queryKey: ['ai-pages'] })
      queryClient.invalidateQueries({ queryKey: ['analytics', 'insights'] })
      queryClient.invalidateQueries({ queryKey: ['analytics', 'sentiment-summary'] })
      queryClient.invalidateQueries({ queryKey: ['analytics', 'segments'] })
    }

    i18n.on('languageChanged', onLanguageChange)
    return () => { i18n.off('languageChanged', onLanguageChange) }
  }, [i18n, queryClient])
}

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
  const lang = useUiLanguage()

  // queryKey includes `lang` so toggling EN↔AR triggers a fresh fetch.
  // Backend returns the matching language's persona prose; the rest of the
  // payload (cluster math, sizes, content-type breakdown) is identical
  // across languages so the cache miss is cheap.
  return useQuery({
    queryKey: ['analytics', 'segments', firstAccountId, lang],
    queryFn: () => fetchSegments(firstAccountId!, lang),
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

export function useHashtagPerformance(days = 30) {
  return useQuery({
    queryKey: ['analytics', 'hashtags', days],
    queryFn: () => fetchHashtagPerformance(days),
    staleTime: 60_000,
  })
}

export function useTopPosts(limit = 10) {
  return useQuery({
    queryKey: ['analytics', 'posts-top', limit],
    queryFn: () => fetchTopPosts(limit),
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

export function useEngagementTimeline(days = 30) {
  return useQuery({
    queryKey: ['analytics', 'engagement-timeline', days],
    queryFn: () => fetchEngagementTimeline(days),
    staleTime: 60_000,
  })
}

export function useCompetitorLeaderboard() {
  return useQuery({
    queryKey: ['market', 'competitors-leaderboard'],
    queryFn: fetchCompetitorLeaderboard,
    staleTime: 5 * 60_000,
  })
}

export function useCompetitorTopPosts() {
  return useQuery({
    queryKey: ['market', 'competitors-top-posts'],
    queryFn: fetchCompetitorTopPosts,
    staleTime: 5 * 60_000,
  })
}

export function useHashtagTrends() {
  return useQuery({
    queryKey: ['market', 'hashtag-trends'],
    queryFn: fetchHashtagTrends,
    staleTime: 5 * 60_000,
  })
}

export function useRegenerateSegments() {
  const queryClient = useQueryClient()
  const accounts = useAccounts()
  const firstAccountId = accounts.data?.[0]?.id
  const lang = useUiLanguage()

  return useMutation({
    mutationFn: () => regenerateSegments(firstAccountId!, lang),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics', 'segments'] })
    },
  })
}

export function useInsights() {
  const lang = useUiLanguage()
  return useQuery({
    queryKey: ['analytics', 'insights', lang],
    queryFn: () => fetchInsights(lang),
    staleTime: 60_000,
  })
}

export function useRecommendationFeedback() {
  return useQuery({
    queryKey: ['analytics', 'recommendation-feedback'],
    queryFn: fetchRecommendationFeedback,
    staleTime: 60_000,
  })
}

export function useSubmitRecommendationFeedback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      recommendation_text: string
      feedback: RecFeedback
      insight_result_id?: string | null
    }) => submitRecommendationFeedback(body),
    onMutate: async (vars) => {
      // Optimistic update — fill the icon immediately.
      await queryClient.cancelQueries({ queryKey: ['analytics', 'recommendation-feedback'] })
      const prev = queryClient.getQueryData<{ feedback: { recommendation_text: string; feedback: RecFeedback }[] }>(
        ['analytics', 'recommendation-feedback'],
      )
      queryClient.setQueryData(
        ['analytics', 'recommendation-feedback'],
        (old: { feedback: { recommendation_text: string; feedback: RecFeedback }[] } | undefined) => {
          const cur = old?.feedback ?? []
          const without = cur.filter((f) => f.recommendation_text !== vars.recommendation_text)
          return { feedback: [...without, { recommendation_text: vars.recommendation_text, feedback: vars.feedback }] }
        },
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(['analytics', 'recommendation-feedback'], ctx.prev)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics', 'recommendation-feedback'] })
    },
  })
}

export function useGenerateInsights() {
  const queryClient = useQueryClient()
  const lang = useUiLanguage()

  return useMutation({
    mutationFn: () => generateInsights(lang),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics', 'insights', lang] })
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
  const lang = useUiLanguage()
  return useQuery({
    queryKey: ['analytics', 'sentiment-summary', accountId ?? 'all', lang],
    queryFn: () => fetchSentimentSummary(accountId, lang),
    staleTime: 5 * 60_000,
  })
}

// AI page-level hooks (longer staleTime since each call hits Gemini).
// `lang` is part of every queryKey so toggling EN↔AR triggers a fresh
// fetch against the backend — which then serves cached Gemini output
// for that language from `ai_page_cache` when it's <24h old.

export function usePostsInsights() {
  const lang = useUiLanguage()
  return useQuery({
    queryKey: ['ai-pages', 'posts-insights', lang],
    queryFn: () => fetchPostsInsights(lang),
    staleTime: 5 * 60_000,
  })
}

export function useGenerateCaption() {
  return useMutation({
    mutationFn: (req: GenerateCaptionRequest) => generateCaption(req),
  })
}

export function useAudienceInsights() {
  const lang = useUiLanguage()
  return useQuery({
    queryKey: ['ai-pages', 'audience-insights', lang],
    queryFn: () => fetchAudienceInsights(lang),
    staleTime: 5 * 60_000,
  })
}

export function useContentPlan() {
  const lang = useUiLanguage()
  return useQuery({
    queryKey: ['ai-pages', 'content-plan', lang],
    queryFn: () => fetchContentPlan(lang),
    staleTime: 5 * 60_000,
  })
}

export function useUpdateContentPlanTopic() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateContentPlanTopicRequest) => updateContentPlanTopic(body),
    onSuccess: () => {
      // Refresh the Content Plan query so the user sees their edit immediately
      // on return to /content-plan.
      queryClient.invalidateQueries({ queryKey: ['ai-pages', 'content-plan'] })
    },
  })
}

export function useRegenerateContentPlan() {
  const lang = useUiLanguage()
  const queryClient = useQueryClient()
  return useMutation({
    // Server deletes the cached row for (account, "content-plan", language);
    // invalidating the query then refetches and the GET endpoint regenerates
    // the plan inline since there's nothing in cache.
    mutationFn: () => regenerateContentPlan(lang),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-pages', 'content-plan'] })
    },
  })
}

export function useSentimentResponses() {
  const lang = useUiLanguage()
  return useQuery({
    queryKey: ['ai-pages', 'sentiment-responses', lang],
    queryFn: () => fetchSentimentResponses(lang),
    staleTime: 5 * 60_000,
  })
}

// ── "Generate all 7 posts" batch flow ────────────────────────────────────

export function useStartBatchGenerate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: StartBatchGenerateRequest) => startBatchGenerate(body),
    onSuccess: () => {
      // The latest-progress query backs the "is there a running batch?" check
      // on Content Plan page mount; refresh it so the user's just-started batch
      // shows up if they navigate away and back.
      queryClient.invalidateQueries({ queryKey: ['ai-pages', 'content-plan', 'batch-progress', 'latest'] })
    },
  })
}

/** Poll the batch progress every 4s while running, then back off. Disabled
 *  when batchId is null so we don't fire the request before the user has
 *  actually started a batch. The polling stops once status leaves "running"
 *  by setting refetchInterval to false. */
export function useBatchProgress(batchId: string | null) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: ['ai-pages', 'content-plan', 'batch-progress', batchId],
    queryFn: () => fetchBatchProgress(batchId!),
    enabled: !!batchId,
    // Refetch every 4s while running. The function form lets us stop polling
    // when the batch reaches a terminal state, so the progress modal isn't
    // hammering the API after completion.
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 4000
      return data.status === 'running' ? 4000 : false
    },
    // On terminal status, bust the content-plan cache once so the per-day
    // badges (Draft ready / Scheduled ✓ / etc.) update on return to the page.
    // gcTime kept short so a completed batch doesn't linger forever in cache.
    gcTime: 60 * 60_000,
    structuralSharing: (oldData, newData) => {
      const prev = oldData as { status?: string } | undefined
      const next = newData as { status?: string } | undefined
      if (prev?.status === 'running' && next?.status && next.status !== 'running') {
        queryClient.invalidateQueries({ queryKey: ['ai-pages', 'content-plan'] })
      }
      return newData as typeof oldData
    },
  })
}

/** Fetch the most recent batch for the user's primary account+language. Used
 *  on Content Plan page mount to resume polling if a batch is in flight. */
export function useLatestBatchProgress() {
  const lang = useUiLanguage()
  return useQuery({
    queryKey: ['ai-pages', 'content-plan', 'batch-progress', 'latest', lang],
    queryFn: () => fetchLatestBatchProgress(lang),
    staleTime: 30_000,
  })
}
