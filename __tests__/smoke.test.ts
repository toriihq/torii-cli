import * as path from 'node:path'
import * as fs from 'node:fs'
import { parseSpec } from '../src/lib/spec'

const REAL_SPEC_PATH = path.join(__dirname, 'fixtures', 'real-spec.json')
const MINI_SPEC_PATH = path.join(__dirname, 'fixtures', 'mini-spec.json')

const hasRealSpec = fs.existsSync(REAL_SPEC_PATH)

describe('smoke test with mini spec', () => {
  let operations: ReturnType<typeof parseSpec>

  beforeAll(() => {
    const spec = require(MINI_SPEC_PATH)
    operations = parseSpec(spec)
  })

  test('produces expected number of operations', () => {
    // mini-spec has: apps(list,create,get,update,search), users(list), files(url,upload,download) = 9
    expect(operations.length).toBe(9)
  })

  test('has no duplicate group+action pairs', () => {
    const keys = operations.map((o) => `${o.group}:${o.action}`)
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i)
    expect(dupes).toEqual([])
  })

  test('excludes SCIM routes', () => {
    expect(operations.find((o) => o.group === 'scim')).toBeUndefined()
  })

  test('excludes anonymize routes', () => {
    expect(operations.find((o) => o.group === 'anonymization')).toBeUndefined()
  })

  test('includes expected groups', () => {
    const groups = [...new Set(operations.map((o) => o.group))]
    expect(groups).toContain('apps')
    expect(groups).toContain('users')
    expect(groups).toContain('files')
  })

  test('apps group has expected actions', () => {
    const appActions = operations
      .filter((o) => o.group === 'apps')
      .map((o) => o.action)
      .sort()
    expect(appActions).toContain('list')
    expect(appActions).toContain('get')
    expect(appActions).toContain('create')
    expect(appActions).toContain('update')
    expect(appActions).toContain('search')
  })

  test('body params mapped as payload', () => {
    const createOp = operations.find((o) => o.group === 'apps' && o.action === 'create')
    expect(createOp!.params.find((p) => p.name === 'payload' && p.in === 'body')).toBeDefined()
  })
})

// Conditionally run real spec tests only when fixture exists
// Generate with: cd projects/toriihq && node docs/generateSwagger.js > ../../packages/cli/__tests__/fixtures/real-spec.json
;(hasRealSpec ? describe : describe.skip)('smoke test with real spec', () => {
  let operations: ReturnType<typeof parseSpec>

  beforeAll(() => {
    const spec = require(REAL_SPEC_PATH)
    operations = parseSpec(spec)
  })

  test('produces non-zero operations', () => {
    expect(operations.length).toBeGreaterThan(10)
  })

  test('has no duplicate group+action pairs', () => {
    const keys = operations.map((o) => `${o.group}:${o.action}`)
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i)
    expect(dupes).toEqual([])
  })

  test('excludes SCIM routes', () => {
    expect(operations.find((o) => o.group === 'scim')).toBeUndefined()
  })

  test('excludes anonymize routes', () => {
    expect(operations.find((o) => o.group === 'anonymization')).toBeUndefined()
  })

  test('includes expected groups', () => {
    const groups = [...new Set(operations.map((o) => o.group))]
    expect(groups).toContain('apps')
    expect(groups).toContain('users')
    expect(groups).toContain('contracts')
  })

  test('apps group has expected actions', () => {
    const appActions = operations
      .filter((o) => o.group === 'apps')
      .map((o) => o.action)
      .sort()
    expect(appActions).toContain('list')
    expect(appActions).toContain('get')
  })
})
