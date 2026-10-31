import { useQuery } from '@tanstack/react-query'
import { getMatch, getMatches, getScorecard } from '../../../apis/matches'

export const useMatches = () => useQuery({ queryKey: ['matches'], queryFn: getMatches })

export const useMatch = (id: string) =>
  useQuery({ queryKey: ['match', id], queryFn: () => getMatch(id) })

export const useScorecard = (id: string) =>
  useQuery({ queryKey: ['scorecard', id], queryFn: () => getScorecard(id) })
