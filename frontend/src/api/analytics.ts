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
}

export async function fetchPostsBreakdown(): Promise<PostsBreakdownData> {
  const res = await api.get<unknown, ApiResponse<PostsBreakdownData>>('/analytics/posts/breakdown')
  return res.data
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
  generated_at: string
}

export async function fetchInsights(): Promise<InsightData | null> {
  const res = await api.get<unknown, ApiResponse<InsightData | null>>('/analytics/insights')
  return res.data
}

export async function generateInsights(): Promise<{ task_id: string }> {
  const res = await api.post<unknown, ApiResponse<{ task_id: string; status: string }>>('/analytics/insights/generate')
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

export async function fetchSentimentSummary(accountId?: string): Promise<SentimentSummaryData> {
  const qs = accountId ? `?account_id=${accountId}` : ''
  const res = await api.get<unknown, ApiResponse<SentimentSummaryData>>(`/analytics/sentiment/summary${qs}`)
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
}

export interface PostsInsightsData {
  best_post: BestPost | null
  why_it_worked: string
  low_performers_pattern: string
  what_to_change: string
}

export async function fetchPostsInsights(): Promise<PostsInsightsData> {
  const res = await api.get<unknown, ApiResponse<PostsInsightsData>>('/ai-pages/posts-insights')
  return res.data
}

export interface GenerateCaptionRequest {
  content_type?: string
  topic?: string
  language: 'en' | 'ar'
  reference_caption?: string
  post_id?: string
}

export async function generateCaption(req: GenerateCaptionRequest): Promise<{ caption: string }> {
  const res = await api.post<unknown, ApiResponse<{ caption: string }>>(
    '/ai-pages/generate-caption',
    req,
  )
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

export async function fetchAudienceInsights(): Promise<AudienceInsightsData> {
  const res = await api.get<unknown, ApiResponse<AudienceInsightsData>>('/ai-pages/audience-insights')
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

export async function fetchContentPlan(): Promise<ContentPlanData> {
  const res = await api.get<unknown, ApiResponse<ContentPlanData>>('/ai-pages/content-plan')
  return res.data
}

export interface SentimentResponseTemplate {
  post_id: string
  response_template: string
}

export interface SentimentResponsesData {
  templates: SentimentResponseTemplate[]
}

export async function fetchSentimentResponses(): Promise<SentimentResponsesData> {
  const res = await api.get<unknown, ApiResponse<SentimentResponsesData>>('/ai-pages/sentiment-responses')
  return res.data
}
