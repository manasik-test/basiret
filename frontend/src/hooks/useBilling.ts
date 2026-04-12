import { useQuery } from '@tanstack/react-query'
import { fetchSubscription } from '../api/billing'

export function useSubscription() {
  return useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: fetchSubscription,
    staleTime: 60_000,
  })
}

export function useIsFeatureLocked(feature: string): boolean {
  const { data } = useSubscription()
  if (!data) return false
  const lockedFeatures = ['sentiment_analysis', 'audience_segmentation', 'content_recommendations']
  return data.plan_tier === 'starter' && lockedFeatures.includes(feature)
}
