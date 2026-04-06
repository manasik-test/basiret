import { useQuery } from '@tanstack/react-query'
import { fetchOverview, fetchSentiment, fetchAccounts, fetchSegments } from '../api/analytics'

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
