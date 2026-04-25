import api from './client'

export interface OverviewData {
  total_posts: number
  total_likes: number
  total_comments: number
  total_engagement: number
  connected_accounts: number
  avg_engagement_per_post: number
}

// Matches the real API shape from /api/v1/analytics/sentiment
interface RawSentimentResponse {
  total_analyzed: number
  pending_analysis: number
  sentiment: {
    positive?: { count: number; avg_score: number }
    neutral?: { count: number; avg_score: number }
    negative?: { count: number; avg_score: number }
  }
}

export interface SentimentData {
  positive: number
  neutral: number
  negative: number
  avg_score: number
  total_analyzed: number
}

export interface SocialAccount {
  id: string
  platform: string
  account_name: string | null
}

export interface SegmentCharacteristics {
  avg_engagement?: number
  dominant_content_type?: string
  dominant_sentiment?: string
  typical_posting_time?: string
  silhouette_score?: number
  post_ids?: string[]
  centroid?: Record<string, number>
}

export interface SegmentsData {
  social_account_id: string
  segment_count: number
  generated_at: string | null
  segments: Array<{
    id: string
    cluster_id: number
    label: string
    size: number
    characteristics?: SegmentCharacteristics
  }>
}

export interface SentimentTimelineEntry {
  date: string
  positive: number
  neutral: number
  negative: number
}

export interface SentimentTimelineData {
  timeline: SentimentTimelineEntry[]
}

interface ApiResponse<T> {
  success: boolean
  data: T
  error: string | null
}

export async function fetchOverview(): Promise<OverviewData> {
  const res = await api.get<unknown, ApiResponse<OverviewData>>('/analytics/overview')
  return res.data
}

export async function fetchSentiment(): Promise<SentimentData> {
  const res = await api.get<unknown, ApiResponse<RawSentimentResponse>>('/analytics/sentiment')
  const raw = res.data
  const pos = raw.sentiment.positive
  const neu = raw.sentiment.neutral
  const neg = raw.sentiment.negative

  const totalCount = (pos?.count ?? 0) + (neu?.count ?? 0) + (neg?.count ?? 0)
  const weightedSum =
    (pos?.count ?? 0) * (pos?.avg_score ?? 0) +
    (neu?.count ?? 0) * (neu?.avg_score ?? 0) +
    (neg?.count ?? 0) * (neg?.avg_score ?? 0)

  return {
    positive: pos?.count ?? 0,
    neutral: neu?.count ?? 0,
    negative: neg?.count ?? 0,
    avg_score: totalCount > 0 ? weightedSum / totalCount : 0,
    total_analyzed: raw.total_analyzed,
  }
}

export async function fetchAccounts(): Promise<SocialAccount[]> {
  const res = await api.get<unknown, ApiResponse<{ accounts: SocialAccount[] }>>('/analytics/accounts')
  return res.data.accounts
}

export async function fetchSegments(socialAccountId: string): Promise<SegmentsData> {
  const res = await api.get<unknown, ApiResponse<SegmentsData>>(
    `/analytics/segments?social_account_id=${socialAccountId}`,
  )
  return res.data
}

export interface PostsBreakdownData {
  by_type: Array<{
    content_type: string
    count: number
    avg_likes: number
    avg_comments: number
  }>
  posting_dates: Array<{
    date: string
    count: number
  }>
  by_language: Array<{
    language: 'en' | 'ar' | 'unknown'
    count: number
    avg_likes: number
    avg_comments: number
    avg_engagement: number
  }>
}

export async function fetchPostsBreakdown(): Promise<PostsBreakdownData> {
  const res = await api.get<unknown, ApiResponse<PostsBreakdownData>>('/analytics/posts/breakdown')
  return res.data
}

export interface HashtagPerformanceEntry {
  hashtag: string
  uses: number
  avg_engagement: number
  avg_engagement_delta: number
  best_content_type: string
}

export interface HashtagPerformanceData {
  hashtags: HashtagPerformanceEntry[]
  account_baseline_avg: number
  total_posts_analyzed: number
}

export async function fetchHashtagPerformance(days = 30): Promise<HashtagPerformanceData> {
  const res = await api.get<unknown, ApiResponse<HashtagPerformanceData>>(
    `/analytics/hashtags?days=${days}`,
  )
  return res.data
}

export interface TopPost {
  id: string
  caption: string
  content_type: string
  thumbnail_url: string | null
  permalink: string | null
  likes: number
  comments: number
  posted_at: string | null
}

export async function fetchTopPosts(limit = 10): Promise<TopPost[]> {
  const res = await api.get<unknown, ApiResponse<{ posts: TopPost[] }>>(
    `/analytics/posts/top?limit=${limit}`,
  )
  return res.data.posts
}

export async function fetchSentimentTimeline(): Promise<SentimentTimelineData> {
  const res = await api.get<unknown, ApiResponse<SentimentTimelineData>>('/analytics/sentiment/timeline')
  return res.data
}

export async function regenerateSegments(socialAccountId: string): Promise<{ task_id: string }> {
  const res = await api.post<unknown, ApiResponse<{ task_id: string; status: string }>>(
    `/analytics/segments/regenerate?social_account_id=${socialAccountId}`,
  )
  return res.data
}

export interface InsightAction {
  priority: 'high' | 'medium' | 'low'
  title: string
  finding: string
  action: string
  timeframe: string
  expected_impact: string
}

export interface InsightData {
  id: string
  social_account_id: string
  week_start: string
  summary: string
  score: number
  score_change: number
  insights: InsightAction[]
  best_post_id: string | null
  next_best_time: string
  language: 'en' | 'ar'
  generated_at: string
}

export async function fetchInsights(lang: 'en' | 'ar' = 'en'): Promise<InsightData | null> {
  const res = await api.get<unknown, ApiResponse<InsightData | null>>(
    `/analytics/insights?lang=${lang}`,
  )
  return res.data
}

export type RecFeedback = 'helpful' | 'not_helpful'

export interface RecommendationFeedbackEntry {
  recommendation_text: string
  feedback: RecFeedback
}

export interface RecommendationFeedbackList {
  feedback: RecommendationFeedbackEntry[]
}

export async function fetchRecommendationFeedback(): Promise<RecommendationFeedbackList> {
  const res = await api.get<unknown, ApiResponse<RecommendationFeedbackList>>(
    '/analytics/insights/feedback',
  )
  return res.data
}

export async function submitRecommendationFeedback(body: {
  recommendation_text: string
  feedback: RecFeedback
  insight_result_id?: string | null
}): Promise<RecommendationFeedbackEntry> {
  const res = await api.post<unknown, ApiResponse<RecommendationFeedbackEntry & { id: string }>>(
    '/analytics/insights/feedback',
    body,
  )
  return res.data
}

export async function generateInsights(lang: 'en' | 'ar' = 'en'): Promise<{ task_id: string }> {
  const res = await api.post<unknown, ApiResponse<{ task_id: string; status: string }>>(
    `/analytics/insights/generate?lang=${lang}`,
  )
  return res.data
}

export interface CommentSentimentEntry {
  id: string
  post_id: string
  platform_comment_id: string
  text: string | null
  author_username: string | null
  created_at: string | null
  sentiment: 'positive' | 'neutral' | 'negative' | null
  sentiment_score: number | null
  language: 'en' | 'ar' | 'unknown' | null
}

export interface CommentsAnalyticsData {
  total_comments: number
  total_analyzed: number
  sentiment_counts: { positive: number; neutral: number; negative: number }
  comments: CommentSentimentEntry[]
}

export async function fetchCommentsAnalytics(accountId?: string): Promise<CommentsAnalyticsData> {
  const qs = accountId ? `?account_id=${accountId}` : ''
  const res = await api.get<unknown, ApiResponse<CommentsAnalyticsData>>(`/analytics/comments${qs}`)
  return res.data
}

export type SentimentKey = 'positive' | 'neutral' | 'negative'

export interface Keyword {
  term: string
  count: number
  sentiment: SentimentKey
}

export interface NeedsAttentionPost {
  post_id: string
  platform_post_id: string
  caption: string
  permalink: string | null
  negative_count: number
}

export interface SampleComment {
  id: string
  post_id: string
  text: string
  author_username: string | null
  created_at: string | null
  language: 'en' | 'ar' | 'unknown' | null
}

export interface SentimentSummaryData {
  total_week: number
  total_prev_week: number
  current_counts: Record<SentimentKey, number>
  previous_counts: Record<SentimentKey, number>
  wow_change: Record<SentimentKey, number>
  keywords: Keyword[]
  highlights: string
  needs_attention: NeedsAttentionPost[]
  samples: Record<SentimentKey, SampleComment | null>
}

export async function fetchSentimentSummary(
  accountId?: string,
  language: 'en' | 'ar' = 'en',
): Promise<SentimentSummaryData> {
  const params = new URLSearchParams()
  if (accountId) params.set('account_id', accountId)
  params.set('language', language)
  const res = await api.get<unknown, ApiResponse<SentimentSummaryData>>(
    `/analytics/sentiment/summary?${params.toString()}`,
  )
  return res.data
}

// ── AI page-level endpoints (Gemini-powered) ──────────────────────────────

export interface BestPost {
  id: string
  caption: string
  content_type: string
  likes: number
  comments: number
  posted_at: string | null
  permalink: string | null
  ocr_text: string | null
}

export interface PostsInsightsData {
  best_post: BestPost | null
  why_it_worked: string
  low_performers_pattern: string
  what_to_change: string
}

export async function fetchPostsInsights(language: 'en' | 'ar' = 'en'): Promise<PostsInsightsData> {
  const res = await api.get<unknown, ApiResponse<PostsInsightsData>>(
    `/ai-pages/posts-insights?language=${language}`,
  )
  return res.data
}

export interface GenerateCaptionRequest {
  content_type?: string
  topic?: string
  language: 'en' | 'ar'
  reference_caption?: string
  post_id?: string
  // Client-only: used to key the sessionStorage cache so multiple connected
  // accounts don't share captions. Not sent to the backend (backend scopes
  // by user's org automatically).
  account_id?: string
}

// Build the sessionStorage key for a caption request. Captions are cached
// for the calendar day — `day` is YYYY-MM-DD in the user's local timezone.
// Missing optional fields become empty strings so collisions are impossible
// across (content_type, topic, post_id, language) tuples.
function captionCacheKey(req: GenerateCaptionRequest): string | null {
  if (typeof window === 'undefined' || !req.account_id) return null
  const day = new Date().toISOString().slice(0, 10)
  return [
    'basiret',
    'caption',
    req.account_id,
    day,
    req.content_type ?? '',
    req.topic ?? '',
    req.post_id ?? '',
    req.language,
  ].join(':')
}

export async function generateCaption(req: GenerateCaptionRequest): Promise<{ caption: string }> {
  const key = captionCacheKey(req)
  if (key) {
    try {
      const cached = window.sessionStorage.getItem(key)
      if (cached) return { caption: cached }
    } catch {
      // sessionStorage may be blocked (private mode, strict SameSite). Fall
      // through to the network — the feature still works, just without the
      // cache optimization.
    }
  }

  // Strip the client-only field before sending to the backend.
  const { account_id: _, ...body } = req
  void _
  const res = await api.post<unknown, ApiResponse<{ caption: string }>>(
    '/ai-pages/generate-caption',
    body,
  )
  if (key && res.data?.caption) {
    try {
      window.sessionStorage.setItem(key, res.data.caption)
    } catch {
      // See note above — ignore storage failures.
    }
  }
  return res.data
}

export interface AudienceWant {
  topic: string
  reason: string
}

export interface AudienceInsightsData {
  behavior_summary: string
  what_they_want: AudienceWant[]
  best_time: { day: string; time: string; reason: string }
}

export async function fetchAudienceInsights(language: 'en' | 'ar' = 'en'): Promise<AudienceInsightsData> {
  const res = await api.get<unknown, ApiResponse<AudienceInsightsData>>(
    `/ai-pages/audience-insights?language=${language}`,
  )
  return res.data
}

export interface ContentPlanDay {
  day_index: number
  day_label: string
  date: string
  content_type: string
  best_time: string
  estimated_reach: number
  topic: string
}

export interface ContentPlanData {
  days: ContentPlanDay[]
}

export async function fetchContentPlan(language: 'en' | 'ar' = 'en'): Promise<ContentPlanData> {
  const res = await api.get<unknown, ApiResponse<ContentPlanData>>(
    `/ai-pages/content-plan?language=${language}`,
  )
  return res.data
}

export interface SentimentResponseTemplate {
  post_id: string
  response_template: string
}

export interface SentimentResponsesData {
  templates: SentimentResponseTemplate[]
}

export async function fetchSentimentResponses(language: 'en' | 'ar' = 'en'): Promise<SentimentResponsesData> {
  const res = await api.get<unknown, ApiResponse<SentimentResponsesData>>(
    `/ai-pages/sentiment-responses?language=${language}`,
  )
  return res.data
}

// ── Ask Basiret (conversational Q&A) ──────────────────────────────────────

export interface AskHistoryTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface AskRequest {
  question: string
  language: 'en' | 'ar'
  conversation_history: AskHistoryTurn[]
}

export interface AskResponseData {
  answer: string
  data_used: string[]
  language: 'en' | 'ar'
}

// 503 with `{success:false, data:null, meta:{...}}` (rate limit or provider
// down) is converted to a thrown Error by the shared interceptor — the caller
// renders it as an assistant bubble per the degraded-UX spec.
export async function askBasiret(req: AskRequest): Promise<AskResponseData> {
  const res = await api.post<unknown, ApiResponse<AskResponseData>>('/ai-pages/ask', req)
  return res.data
}
