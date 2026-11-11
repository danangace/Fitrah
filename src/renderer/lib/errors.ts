import { ApiError } from '../api/http-client'

export function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.detail ?? error.code.replaceAll('_', ' ')
  return error instanceof Error ? error.message : 'Unknown error'
}
