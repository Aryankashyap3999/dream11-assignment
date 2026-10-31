import { api } from '../../config/axiosConfig'
import type { AIInsight, AskResponse } from '../../types'

export const getInsights = async (id: string) =>
  (await api.get<{ data: AIInsight }>(`/ai/${id}/insights`)).data.data

export const askMatchPulse = async (id: string, question: string) =>
  (await api.post<{ data: AskResponse }>(`/ai/${id}/ask`, { question })).data.data
