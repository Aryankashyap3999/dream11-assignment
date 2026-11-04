import { isAxiosError } from 'axios'

// The backend sends a user-friendly message for 503 (AI busy) and 429 (rate limited); anything else gets the fallback.
export const apiErrorMessage = (err: unknown, fallback: string) => {
  if (!isAxiosError(err)) return fallback
  const status = err.response?.status
  const message = err.response?.data?.message
  return (status === 503 || status === 429) && typeof message === 'string' ? message : fallback
}
