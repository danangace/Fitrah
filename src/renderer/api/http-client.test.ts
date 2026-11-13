import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod/v4'
import { ApiError, bootstrapSession, request } from './http-client'

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('request', () => {
  it('returns validated data', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }))
    await expect(request('GET', '/api/x', z.object({ ok: z.boolean() }), undefined, fetchImpl)).resolves.toEqual({
      ok: true,
    })
  })

  it('throws ApiError with the server code on failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { error: 'unauthorized' }))
    await expect(request('GET', '/api/x', z.unknown(), undefined, fetchImpl)).rejects.toEqual(
      new ApiError(401, 'unauthorized'),
    )
  })

  it('rejects a response that does not match the schema', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { ok: 'yes' }))
    await expect(request('GET', '/api/x', z.object({ ok: z.boolean() }), undefined, fetchImpl)).rejects.toMatchObject({
      code: 'invalid_response',
    })
  })
})

describe('bootstrapSession', () => {
  it('exchanges the url token for a cookie and strips it from the url', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }))
    const replaceState = vi.fn()
    await bootstrapSession({ href: 'http://127.0.0.1:4317/docs?token=abc&x=1' }, { replaceState }, fetchImpl)
    expect(fetchImpl).toHaveBeenCalledWith('/api/session', expect.objectContaining({ headers: { 'x-nakoda-token': 'abc' } }))
    expect(replaceState).toHaveBeenCalledWith(null, '', '/docs?x=1')
  })

  it('does nothing without a token', async () => {
    const fetchImpl = vi.fn()
    await bootstrapSession({ href: 'http://127.0.0.1:4317/' }, { replaceState: vi.fn() }, fetchImpl)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
