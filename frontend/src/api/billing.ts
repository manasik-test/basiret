import api from './client'

export interface Plan {
  tier: string
  name: string
  price: number | null
  currency: string
  features: string[]
}

export interface SubscriptionData {
  plan_tier: string
  status: string
  stripe_customer_id: string | null
  current_period_end: string | null
}

interface ApiResponse<T> {
  success: boolean
  data: T
}

export async function fetchPlans(): Promise<Plan[]> {
  const res = await api.get<unknown, ApiResponse<{ plans: Plan[] }>>('/billing/plans')
  return res.data.plans
}

export async function fetchSubscription(): Promise<SubscriptionData> {
  const res = await api.get<unknown, ApiResponse<SubscriptionData>>('/billing/subscription')
  return res.data
}

export async function createCheckout(): Promise<string> {
  const res = await api.post<unknown, ApiResponse<{ checkout_url: string }>>('/billing/create-checkout')
  return res.data.checkout_url
}
