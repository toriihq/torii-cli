import { ToriiClient } from '../src/lib/client'

// Mock global fetch
const mockFetch = jest.fn()
global.fetch = mockFetch as any

describe('ToriiClient', () => {
  let client: ToriiClient

  beforeEach(() => {
    mockFetch.mockReset()
    client = new ToriiClient({
      apiUrl: 'https://api.toriihq.com',
      apiKey: 'test-key',
      timeout: 5000
    })
  })

  test('sends GET with auth header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ apps: [] }),
      headers: new Headers()
    })

    const result = await client.request('GET', '/v1.0/apps', { size: '5' })
    expect(result.status).toBe(200)
    expect(result.data).toEqual({ apps: [] })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.toriihq.com/v1.0/apps?size=5',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key'
        })
      })
    )
  })

  test('sends POST with JSON body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'new' }),
      headers: new Headers()
    })

    const result = await client.request('POST', '/v1.0/apps', {}, { name: 'Slack' })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.toriihq.com/v1.0/apps',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Slack' }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      })
    )
  })

  test('returns error envelope for 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Invalid API key' }),
      headers: new Headers()
    })

    const result = await client.request('GET', '/v1.0/apps')
    expect(result.status).toBe(401)
    expect(result.error).toBe('Unauthorized')
  })

  test('parses Retry-After for 429', async () => {
    const headers = new Headers()
    headers.set('Retry-After', '30')
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ message: 'Rate limited' }),
      headers
    })

    const result = await client.request('GET', '/v1.0/apps')
    expect(result.status).toBe(429)
    expect(result.retryAfter).toBe(30)
  })

  test('substitutes path params', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'abc' }),
      headers: new Headers()
    })

    await client.request('GET', '/v1.0/apps/{idApp}', {}, undefined, { idApp: 'abc123' })
    expect(mockFetch).toHaveBeenCalledWith('https://api.toriihq.com/v1.0/apps/abc123', expect.anything())
  })

  test('buildDryRun returns request details without fetching', () => {
    const result = client.buildDryRun('GET', '/v1.0/apps', { size: '5' })
    expect(result.method).toBe('GET')
    expect(result.url).toBe('https://api.toriihq.com/v1.0/apps?size=5')
    expect(result.headers.Authorization).toBe('Bearer test-key')
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('ToriiClient pagination', () => {
  let client: ToriiClient

  beforeEach(() => {
    mockFetch.mockReset()
    client = new ToriiClient({
      apiUrl: 'https://api.toriihq.com',
      apiKey: 'test-key',
      timeout: 5000
    })
  })

  test('cursor-based pagination follows nextCursor', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ apps: [{ id: '1' }], nextCursor: 'c2', total: 2 })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ apps: [{ id: '2' }], nextCursor: null, total: 2 })
      })

    const result = await client.requestAllPages('GET', '/v1.0/apps', {}, { pageLimit: 100, pageDelay: 0 })
    expect(result.items).toEqual([{ id: '1' }, { id: '2' }])
    expect(result.pages).toBe(2)
    expect(result.total).toBe(2)
  })

  test('pagination respects pageLimit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ apps: [{ id: '1' }], nextCursor: 'c2', total: 100 })
    })

    const result = await client.requestAllPages('GET', '/v1.0/apps', {}, { pageLimit: 1, pageDelay: 0 })
    expect(result.items).toEqual([{ id: '1' }])
    expect(result.pages).toBe(1)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
