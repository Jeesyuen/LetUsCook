import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { callRunPodChat, getAIRestockAdvice, isRunPodConfigured } from './runpodClient'

const messages = [{ role: 'user' as const, content: 'Hi' }]

function mockFetch(response: Response | Error) {
  const fetchMock = vi.fn(() => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response)))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const okResponse = (content: string) =>
  new Response(JSON.stringify({ output: [{ choices: [{ message: { content } }] }] }), { status: 200 })

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('RunPod client', () => {
  it('is off unless VITE_RUNPOD_ENABLED is true', async () => {
    vi.stubEnv('VITE_RUNPOD_ENABLED', 'false')
    const fetchMock = mockFetch(okResponse('unused'))
    expect(isRunPodConfigured()).toBe(false)
    expect(await callRunPodChat({ messages })).toMatchObject({ success: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  describe('when enabled', () => {
    beforeEach(() => vi.stubEnv('VITE_RUNPOD_ENABLED', 'true'))

    it('calls the dev proxy without sending an API key', async () => {
      const fetchMock = mockFetch(okResponse('PONG'))
      const res = await callRunPodChat({ messages })
      expect(res).toMatchObject({ success: true, content: 'PONG' })
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
      expect(url).toMatch(/^\/api\/runpod\/v2\/[^/]+\/runsync$/)
      expect(init.headers).not.toHaveProperty('Authorization')
    })

    it('reports HTTP errors', async () => {
      mockFetch(new Response('Unauthorized', { status: 401 }))
      const res = await callRunPodChat({ messages })
      expect(res.success).toBe(false)
      expect(res.error).toContain('401')
    })

    it('reports network failures', async () => {
      mockFetch(new Error('network down'))
      expect(await callRunPodChat({ messages })).toMatchObject({ success: false, error: 'network down' })
    })

    it('returns null restock advice when the call fails, so the rule-based text is used', async () => {
      mockFetch(new Response('boom', { status: 500 }))
      expect(await getAIRestockAdvice('Failing Beans', 'kg', 5, 2, 2.5, 20, 3)).toBeNull()
    })

    it('strips quotes from restock advice and caches it', async () => {
      const fetchMock = mockFetch(okResponse('"Order 20 kg today."'))
      expect(await getAIRestockAdvice('Cached Beans', 'kg', 5, 2, 2.5, 20, 3)).toBe('Order 20 kg today.')
      expect(await getAIRestockAdvice('Cached Beans', 'kg', 5, 2, 2.5, 20, 3)).toBe('Order 20 kg today.')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })
})
