import api from './client'

export type GoalMetric =
  | 'avg_engagement_rate'
  | 'posts_per_week'
  | 'positive_sentiment_pct'
  | 'follower_growth_pct'

export type GoalPeriod = 'weekly' | 'monthly'

export interface Goal {
  id: string
  social_account_id: string
  metric: GoalMetric
  target_value: number
  current_value: number | null
  period: GoalPeriod
  is_active: boolean
  created_at: string | null
}

export interface GoalsListData {
  goals: Goal[]
  social_account_id?: string
}

interface ApiResponse<T> {
  success: boolean
  data: T
  error: string | null
}

export async function fetchGoals(): Promise<GoalsListData> {
  const res = await api.get<unknown, ApiResponse<GoalsListData>>('/goals')
  return res.data
}

export async function createGoal(body: {
  metric: GoalMetric
  target_value: number
  period: GoalPeriod
}): Promise<Goal> {
  const res = await api.post<unknown, ApiResponse<Goal>>('/goals', body)
  return res.data
}

export async function deleteGoal(goalId: string): Promise<void> {
  await api.delete(`/goals/${goalId}`)
}
