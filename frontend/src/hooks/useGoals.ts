import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchGoals, createGoal, deleteGoal, type GoalMetric, type GoalPeriod } from '../api/goals'

export function useGoals() {
  return useQuery({
    queryKey: ['goals'],
    queryFn: fetchGoals,
    staleTime: 30_000,
  })
}

export function useCreateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { metric: GoalMetric; target_value: number; period: GoalPeriod }) =>
      createGoal(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
    },
  })
}

export function useDeleteGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (goalId: string) => deleteGoal(goalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
    },
  })
}
