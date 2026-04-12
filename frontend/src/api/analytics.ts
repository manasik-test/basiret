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
