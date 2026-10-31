import { api } from '../../config/axiosConfig'
import type { Analysis } from '../../types'

export const getAnalysis = async (id: string) =>
  (await api.get<{ data: Analysis }>(`/analysis/${id}`)).data.data
