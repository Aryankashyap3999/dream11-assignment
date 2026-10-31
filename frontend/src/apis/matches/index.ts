import { api } from '../../config/axiosConfig'
import type { Match, MatchDetails, Scorecard } from '../../types'

export const getMatches = async () => (await api.get<{ data: Match[] }>('/matches')).data.data

export const getMatch = async (id: string) =>
  (await api.get<{ data: MatchDetails }>(`/matches/${id}`)).data.data

export const getScorecard = async (id: string) =>
  (await api.get<{ data: Scorecard }>(`/matches/${id}/scorecard`)).data.data
