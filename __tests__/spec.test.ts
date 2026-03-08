import * as path from 'node:path'
import { parseSpec, type CliOperation } from '../src/lib/spec'

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'mini-spec.json')

describe('spec parser', () => {
  let operations: CliOperation[]

  beforeAll(async () => {
    const spec = require(FIXTURE_PATH)
    operations = parseSpec(spec)
  })

  test('extracts apps list operation', () => {
    const op = operations.find((o) => o.group === 'apps' && o.action === 'list')
    expect(op).toBeDefined()
    expect(op!.method).toBe('get')
    expect(op!.path).toBe('/v1.0/apps')
    expect(op!.params).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'fields', in: 'query', type: 'string' }),
        expect.objectContaining({ name: 'size', in: 'query', type: 'number' })
      ])
    )
  })

  test('derives action "search" from sub-path', () => {
    const op = operations.find((o) => o.group === 'apps' && o.action === 'search')
    expect(op).toBeDefined()
    expect(op!.method).toBe('get')
  })

  test('derives action "get" for path with param', () => {
    const op = operations.find((o) => o.group === 'apps' && o.action === 'get')
    expect(op).toBeDefined()
    expect(op!.params).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'idApp', in: 'path', required: true })])
    )
  })

  test('derives action "create" for POST without sub-path', () => {
    const op = operations.find((o) => o.group === 'apps' && o.action === 'create')
    expect(op).toBeDefined()
    expect(op!.method).toBe('post')
  })

  test('derives action "update" for PUT', () => {
    const op = operations.find((o) => o.group === 'apps' && o.action === 'update')
    expect(op).toBeDefined()
    expect(op!.method).toBe('put')
  })

  test('slugifies group names from tags', () => {
    const groups = [...new Set(operations.map((o) => o.group))]
    expect(groups).toContain('apps')
    expect(groups).toContain('users')
    expect(groups).toContain('files')
  })

  test('excludes SCIM routes by tag', () => {
    const scim = operations.find((o) => o.group === 'scim')
    expect(scim).toBeUndefined()
  })

  test('excludes anonymize routes by tag', () => {
    const anon = operations.find((o) => o.group === 'anonymization')
    expect(anon).toBeUndefined()
  })

  test('detects files/upload as upload kind', () => {
    const upload = operations.find((o) => o.path === '/v1.0/files/upload')
    expect(upload).toBeDefined()
    expect(upload!.kind).toBe('upload')
  })

  test('detects files/download as download kind', () => {
    const download = operations.find((o) => o.path.endsWith('/download'))
    expect(download).toBeDefined()
    expect(download!.kind).toBe('download')
  })

  test('includes files/url as json kind', () => {
    const url = operations.find((o) => o.group === 'files' && o.action === 'url')
    expect(url).toBeDefined()
    expect(url!.kind).toBe('json')
  })

  test('excludes internal tags (Backoffice)', () => {
    const bo = operations.find((o) => o.group === 'backoffice')
    expect(bo).toBeUndefined()
  })

  test('no duplicate group+action combinations', () => {
    const keys = operations.map((o) => `${o.group}:${o.action}`)
    expect(keys.length).toBe(new Set(keys).size)
  })

  test('maps integer type to number', () => {
    const op = operations.find((o) => o.group === 'apps' && o.action === 'list')
    const sizeParam = op!.params.find((p) => p.name === 'size')
    expect(sizeParam!.type).toBe('number')
  })
})
