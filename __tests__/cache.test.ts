import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { SpecCache } from '../src/lib/cache'

describe('SpecCache', () => {
  let cacheDir: string
  let cache: SpecCache

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'torii-cli-test-'))
    cache = new SpecCache(cacheDir)
  })

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true })
  })

  test('get returns null when cache is empty', () => {
    expect(cache.get('https://api.toriihq.com')).toBeNull()
  })

  test('set and get round-trip', () => {
    const spec = { paths: { '/v1.0/apps': {} } }
    cache.set('https://api.toriihq.com', spec)
    expect(cache.get('https://api.toriihq.com')).toEqual(spec)
  })

  test('get returns null when cache is expired', () => {
    const spec = { paths: {} }
    cache.set('https://api.toriihq.com', spec)

    // Manually set mtime to 25 hours ago
    const filePath = cache.getFilePath('https://api.toriihq.com')
    const past = new Date(Date.now() - 25 * 60 * 60 * 1000)
    fs.utimesSync(filePath, past, past)

    expect(cache.get('https://api.toriihq.com')).toBeNull()
  })

  test('getStale returns expired cache', () => {
    const spec = { paths: {} }
    cache.set('https://api.toriihq.com', spec)

    const filePath = cache.getFilePath('https://api.toriihq.com')
    const past = new Date(Date.now() - 25 * 60 * 60 * 1000)
    fs.utimesSync(filePath, past, past)

    expect(cache.getStale('https://api.toriihq.com')).toEqual(spec)
  })

  test('clear removes all cache files', () => {
    cache.set('https://api.toriihq.com', { paths: {} })
    cache.set('https://other.com', { paths: {} })
    cache.clear()
    expect(cache.get('https://api.toriihq.com')).toBeNull()
    expect(cache.get('https://other.com')).toBeNull()
  })

  test('different URLs get different cache files', () => {
    cache.set('https://api1.com', { id: 1 })
    cache.set('https://api2.com', { id: 2 })
    expect(cache.get('https://api1.com')).toEqual({ id: 1 })
    expect(cache.get('https://api2.com')).toEqual({ id: 2 })
  })
})
