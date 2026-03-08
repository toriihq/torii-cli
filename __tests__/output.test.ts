import { formatSuccess, formatError, formatDryRun, ExitCode } from '../src/lib/output'

describe('output', () => {
  let writtenOutput: string
  let exitCode: number | undefined

  beforeEach(() => {
    writtenOutput = ''
    exitCode = undefined
    jest.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
      writtenOutput += chunk
      return true
    })
    jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      exitCode = code
      throw new Error(`process.exit(${code})`)
    }) as any)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('formatSuccess wraps data in envelope with status 200', () => {
    formatSuccess({ apps: [{ id: '1' }], total: 1 })
    const parsed = JSON.parse(writtenOutput)
    expect(parsed).toEqual({
      data: { apps: [{ id: '1' }], total: 1 },
      status: 200
    })
  })

  test('formatSuccess with page-all includes pages and total', () => {
    formatSuccess([{ id: '1' }, { id: '2' }], { pages: 3, total: 2 })
    const parsed = JSON.parse(writtenOutput)
    expect(parsed).toEqual({
      data: [{ id: '1' }, { id: '2' }],
      status: 200,
      pages: 3,
      total: 2
    })
  })

  test('formatSuccess passes through actual HTTP status', () => {
    formatSuccess(null, { status: 204 })
    const parsed = JSON.parse(writtenOutput)
    expect(parsed).toEqual({
      data: null,
      status: 204
    })
  })

  test('formatError wraps error with status code', () => {
    expect(() => formatError(401, 'Unauthorized', 'Invalid API key')).toThrow()
    const parsed = JSON.parse(writtenOutput)
    expect(parsed).toEqual({
      error: 'Unauthorized',
      message: 'Invalid API key',
      status: 401
    })
    expect(exitCode).toBe(ExitCode.API_ERROR)
  })

  test('formatError with retryAfter for 429', () => {
    expect(() => formatError(429, 'Too Many Requests', 'Rate limit exceeded', 30)).toThrow()
    const parsed = JSON.parse(writtenOutput)
    expect(parsed).toEqual({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
      status: 429,
      retryAfter: 30
    })
  })

  test('formatDryRun outputs request details', () => {
    formatDryRun('GET', 'https://api.toriihq.com/v1.0/apps?size=5', {
      Authorization: 'Bearer secret123'
    })
    const parsed = JSON.parse(writtenOutput)
    expect(parsed).toEqual({
      dryRun: true,
      method: 'GET',
      url: 'https://api.toriihq.com/v1.0/apps?size=5',
      headers: { Authorization: 'Bearer ***redacted***' }
    })
  })

  test('ExitCode values are correct', () => {
    expect(ExitCode.SUCCESS).toBe(0)
    expect(ExitCode.API_ERROR).toBe(1)
    expect(ExitCode.CLIENT_ERROR).toBe(2)
  })
})
