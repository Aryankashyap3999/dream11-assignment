import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getReplay, postReplay, type ReplayAction } from '../../../apis/demo'

const POLL_MS = 2000

// Polls replay state while RUNNING; whenever the replay position moves, refetch the live data.
export const useReplay = (id: string) => {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: ['replay', id],
    queryFn: () => getReplay(id),
    refetchInterval: (q) => (q.state.data?.status === 'RUNNING' ? POLL_MS : false),
  })
  const position = query.data?.currentSequence
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ['analysis', id] })
    qc.invalidateQueries({ queryKey: ['scorecard', id] })
  }, [qc, id, position])
  return query
}

export const useReplayAction = (id: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (action: ReplayAction) => postReplay(id, action),
    onSuccess: (data) => qc.setQueryData(['replay', id], data),
  })
}
