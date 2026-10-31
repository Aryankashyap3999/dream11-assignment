import { api } from '../../config/axiosConfig'
import type { Replay } from '../../types'

export type ReplayAction = 'start' | 'pause' | 'reset'

export const getReplay = async (id: string) =>
  (await api.get<{ data: Replay }>(`/demo/${id}`)).data.data

export const postReplay = async (id: string, action: ReplayAction) =>
  (await api.post<{ data: Replay }>(`/demo/${id}/${action}`)).data.data
