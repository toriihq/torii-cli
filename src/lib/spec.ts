import SwaggerParser from '@apidevtools/swagger-parser'
import { SpecCache } from './cache'

export interface CliParam {
  name: string
  in: 'query' | 'path' | 'body' | 'formData'
  type: string
  required: boolean
  description?: string
  enum?: string[]
}

export type OperationKind = 'json' | 'upload' | 'download'

export interface CliOperation {
  group: string
  action: string
  method: string
  path: string
  description: string
  params: CliParam[]
  supportsFilter: boolean
  kind: OperationKind
}

const PUBLIC_TAGS = new Set([
  'Apps',
  'Users',
  'Contracts',
  'Integrations',
  'Workflows',
  'Organizations',
  'Roles',
  'Audit',
  'Files',
  'Transactions',
  'Parsings',
  'Plugins',
  'App Fields',
  'User Fields',
  'Contracts Fields',
  'Applications Users',
  'User Applications'
])

const EXCLUDED_TAGS = new Set(['SCIM', 'Anonymization'])

function slugify(tag: string): string {
  return tag.toLowerCase().replace(/\s+/g, '-')
}

function detectKind(method: string, path: string, operation: any): OperationKind {
  const normalized = path.replace(/^\/v1\.0/, '')
  if (normalized.endsWith('/download') && method === 'get') return 'download'
  const consumes: string[] = operation.consumes || []
  if (consumes.includes('multipart/form-data')) return 'upload'
  return 'json'
}

function isAllowedTag(tag: string): boolean {
  return PUBLIC_TAGS.has(tag) && !EXCLUDED_TAGS.has(tag)
}

function mapType(openApiType: string): string {
  if (openApiType === 'integer') return 'number'
  return openApiType || 'string'
}

/** Build a human-readable description of the expected JSON body from a schema. */
function describeBodySchema(schema: any): string {
  if (!schema) return 'JSON request body'
  try {
    const example = schemaToExample(schema)
    if (example !== undefined) {
      return `JSON body, e.g.: ${JSON.stringify(example)}`
    }
  } catch {
    // Fall through to generic description
  }
  return 'JSON request body'
}

/** Recursively build a minimal example value from a JSON Schema. */
function schemaToExample(schema: any, depth = 0): any {
  if (!schema || depth > 3) return undefined
  if (schema.example !== undefined) return schema.example

  if (schema.type === 'object' && schema.properties) {
    const obj: Record<string, any> = {}
    for (const [key, prop] of Object.entries<any>(schema.properties)) {
      const val = schemaToExample(prop, depth + 1)
      if (val !== undefined) obj[key] = val
    }
    return Object.keys(obj).length > 0 ? obj : undefined
  }

  if (schema.type === 'array' && schema.items) {
    const item = schemaToExample(schema.items, depth + 1)
    return item !== undefined ? [item] : undefined
  }

  if (schema.type === 'string') return schema.enum?.[0] || '<string>'
  if (schema.type === 'number' || schema.type === 'integer') return 0
  if (schema.type === 'boolean') return false

  return undefined
}

function methodVerb(method: string, hasParam: boolean): string {
  switch (method.toLowerCase()) {
    case 'get':
      return hasParam ? 'get' : 'list'
    case 'post':
      return 'create'
    case 'put':
    case 'patch':
      return 'update'
    case 'delete':
      return 'delete'
    default:
      return method.toLowerCase()
  }
}

function deriveAction(method: string, path: string): string {
  // Strip /v1.0 prefix and split
  const stripped = path.replace(/^\/v1\.0/, '')
  const segments = stripped.split('/').filter(Boolean)

  // Find sub-path segments that are not parameters
  const nonParamSegments = segments.slice(1).filter((s) => !s.startsWith('{'))
  const hasParam = segments.some((s) => s.startsWith('{'))

  // Rule 1: If there's a non-parameter sub-path, use it as the action name
  if (nonParamSegments.length > 0) {
    const subPath = nonParamSegments.join('-')
    const kebab = subPath.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
    return kebab
  }

  // Rule 2: No sub-path — use HTTP method mapping
  return methodVerb(method, hasParam)
}

export function parseSpec(spec: any): CliOperation[] {
  const operations: CliOperation[] = []
  const paths = spec.paths || {}
  // Swagger 2.0: basePath field. OpenAPI 3.0: extract path from servers[0].url
  let basePath = (spec.basePath || '').replace(/\/$/, '')
  if (!basePath && spec.servers?.[0]?.url) {
    try {
      basePath = new URL(spec.servers[0].url).pathname.replace(/\/$/, '')
    } catch {
      // servers URL may be relative or invalid — ignore
    }
  }

  for (const [pathStr, methods] of Object.entries<any>(paths)) {
    for (const [method, operation] of Object.entries<any>(methods)) {
      if (method === 'parameters') continue

      const tag = operation.tags?.[0]
      if (!tag || !isAllowedTag(tag)) continue

      const group = slugify(tag)
      const action = deriveAction(method, pathStr)
      const fullPath = basePath ? `${basePath}${pathStr}` : pathStr
      const kind = detectKind(method, pathStr, operation)

      const params: CliParam[] = (operation.parameters || [])
        .filter((p: any) => p.in !== 'body')
        .map((p: any) => {
          const param: CliParam = {
            name: p.name,
            in: p.in as CliParam['in'],
            type: mapType(p.type),
            required: p.required || false,
            description: p.description || ''
          }
          if (p.enum) param.enum = p.enum
          return param
        })

      // Check for body parameter (only for json operations)
      if (kind === 'json') {
        // Swagger 2.0: body param in parameters array
        const bodyParam = (operation.parameters || []).find((p: any) => p.in === 'body')
        // OpenAPI 3.0: requestBody object
        const requestBody = operation.requestBody

        if (bodyParam || requestBody) {
          const schema = bodyParam?.schema || requestBody?.content?.['application/json']?.schema
          const bodyDesc = describeBodySchema(schema)
          const required = bodyParam ? (bodyParam.required || false) : (requestBody?.required !== false)
          params.push({
            name: 'payload',
            in: 'body',
            type: 'object',
            required,
            description: bodyDesc
          })
        }
      }

      // Check for additionalProperties on query-level schema (Joi .unknown())
      let supportsFilter = false
      if (operation['x-additionalProperties'] || operation['x-unknown-query']) {
        supportsFilter = true
      }

      operations.push({
        group,
        action,
        method: method.toLowerCase(),
        path: fullPath,
        description: operation.summary || operation.description || '',
        params,
        supportsFilter,
        kind
      })
    }
  }

  // Deduplicate: when multiple operations share the same group+action,
  // prefix action with the method verb to disambiguate
  const actionCounts = new Map<string, number>()
  for (const op of operations) {
    const key = `${op.group}:${op.action}`
    actionCounts.set(key, (actionCounts.get(key) || 0) + 1)
  }

  for (const op of operations) {
    const key = `${op.group}:${op.action}`
    if (actionCounts.get(key)! > 1) {
      const stripped = op.path.replace(/^\/v1\.0/, '')
      const segments = stripped.split('/').filter(Boolean)
      const hasTrailingParam = segments[segments.length - 1]?.startsWith('{') || false
      const verb = methodVerb(op.method, hasTrailingParam)
      op.action = `${verb}-${op.action}`
    }
  }

  return operations
}

const DEFAULT_SPEC_URL = 'https://developers.toriihq.com/openapi/torii-api-documentation.json'

export async function fetchAndParseSpec(options: {
  specUrl?: string
  noCache?: boolean
}): Promise<CliOperation[]> {
  const specUrl = options.specUrl || DEFAULT_SPEC_URL
  const cache = new SpecCache()

  // Check cache first
  if (!options.noCache) {
    const cached = cache.get(specUrl)
    if (cached) {
      return parseSpec(cached)
    }
  }

  // Fetch spec
  let rawSpec: unknown
  try {
    const response = await fetch(specUrl)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    rawSpec = await response.json()
  } catch (err: any) {
    // Fallback to stale cache
    const stale = cache.getStale(specUrl)
    if (stale) {
      process.stderr.write(`Warning: Using stale cache — spec fetch failed: ${err.message}\n`)
      return parseSpec(stale)
    }
    throw new Error(`Failed to fetch OpenAPI spec from ${specUrl}: ${err.message}`)
  }

  // Dereference $refs (without validation for speed)
  const spec = await SwaggerParser.dereference(rawSpec as any, { validate: { spec: false, schema: false } })

  // Cache it
  cache.set(specUrl, spec)

  return parseSpec(spec)
}
