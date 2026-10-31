import { useMutation, useQuery } from '@tanstack/react-query'
import { askMatchPulse, getInsights } from '../../../apis/ai'

export const useMatchInsights = (id: string) =>
  useQuery({ queryKey: ['insights', id], queryFn: () => getInsights(id), retry: false })

export const useAskMatchPulse = (id: string) =>
  useMutation({ mutationFn: (question: string) => askMatchPulse(id, question) })
