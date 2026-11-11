import type { z } from 'zod/v4'
import { API } from '../../shared/api'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail?: string,
  ) {
    super(detail ?? `${status} ${code}`)
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** Call the runtime and validate the answer with a zod schema (safeParse, never parse). */
export async function request<S extends z.ZodType>(
  method: Method,
  path: string,
  schema: S,
  body?: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<z.infer<S>> {
  const res = await fetchImpl(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json: unknown = res.headers.get('content-type')?.includes('json') ? await res.json() : null
  if (!res.ok) {
    const errBody = json && typeof json === 'object' ? (json as Record<string, unknown>) : {}
    const code = typeof errBody.error === 'string' ? errBody.error : 'request_failed'
    throw new ApiError(res.status, code, typeof errBody.message === 'string' ? errBody.message : undefined)
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) throw new ApiError(res.status, 'invalid_response')
  return parsed.data
}

/**
 * First load: `fitrah start` opens `/?token=…`. Exchange it once for the HttpOnly session
 * cookie, then remove it from the address bar.
 */
export async function bootstrapSession(
  location: Pick<Location, 'href'> = window.location,
  history: Pick<History, 'replaceState'> = window.history,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const url = new URL(location.href)
  const token = url.searchParams.get('token')
  if (!token) return
  const res = await fetchImpl(API.session, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'x-fitrah-token': token },
  })
  if (!res.ok) throw new ApiError(res.status, 'session_failed')
  url.searchParams.delete('token')
  history.replaceState(null, '', url.pathname + url.search + url.hash)
}
