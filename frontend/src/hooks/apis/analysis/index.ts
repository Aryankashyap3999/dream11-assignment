import { useQuery } from '@tanstack/react-query'
import { getAnalysis } from '../../../apis/analysis'

export const useMatchAnalysis = (id: string) =>
  useQuery({ queryKey: ['analysis', id], queryFn: () => getAnalysis(id) })
