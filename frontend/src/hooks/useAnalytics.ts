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
  type GenerateCaptionRequest, type RecFeedback,
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

export function useSentimentResponses() {
  const lang = useUiLanguage()
  return useQuery({
    queryKey: ['ai-pages', 'sentiment-responses', lang],
    queryFn: () => fetchSentimentResponses(lang),
    staleTime: 5 * 60_000,
  })
}
