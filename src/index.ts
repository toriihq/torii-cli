import { program } from 'commander'
import { fetchAndParseSpec } from './lib/spec'
import { buildCommandTree, parseFilters } from './lib/commands'
import { ToriiClient } from './lib/client'
import { formatSuccess, formatError, formatDryRun, formatClientError } from './lib/output'
import { SpecCache } from './lib/cache'
import type { CliOperation } from './lib/spec'

/** Shared helper: fetch and parse the OpenAPI spec using current global options. */
function getSpecOptions(): { specUrl?: string; noCache?: boolean } {
  const globals = program.opts()
  return { specUrl: process.env.TORII_SPEC_URL, noCache: !globals.cache }
}

program
  .name('torii-cli')
  .version('0.1.0')
  .description('Torii CLI — OpenAPI-driven CLI for LLM agents')
  .option('--api-url <url>', 'Torii API base URL', process.env.TORII_API_URL)
  .option('--api-key <key>', 'API Bearer token', process.env.TORII_API_KEY)
  .option('--timeout <ms>', 'Request timeout', '30000')
  .option('--page-all', 'Auto-follow pagination')
  .option('--page-limit <n>', 'Max pages with --page-all', '100')
  .option('--page-delay <ms>', 'Delay between pagination requests', '0')
  .option('--dry-run', 'Preview HTTP request without executing')
  .option('--no-cache', 'Skip spec cache')

// Built-in commands — these do NOT require spec fetch
program
  .command('version')
  .description('Show CLI version')
  .action(() => {
    const pkg = require('../../package.json')
    formatSuccess({ version: pkg.version })
  })

const cacheCmd = program.command('cache').description('Cache management')

cacheCmd
  .command('clear')
  .description('Clear the spec cache')
  .action(() => {
    new SpecCache().clear()
    formatSuccess({ message: 'Cache cleared' })
  })

program
  .command('whoami')
  .description('Show current API environment and organization')
  .action(async () => {
    const globals = program.opts()
    if (!globals.apiKey || !globals.apiUrl) {
      formatSuccess({
        apiUrl: globals.apiUrl || '(not set)',
        apiKey: globals.apiKey ? '***configured***' : '(not set)',
        org: null
      })
      return
    }
    const client = new ToriiClient({
      apiUrl: globals.apiUrl,
      apiKey: globals.apiKey,
      timeout: parseInt(globals.timeout, 10)
    })
    try {
      const operations = await fetchAndParseSpec(getSpecOptions())
      const orgOp = operations.find((o) => o.group === 'organizations' && o.action === 'my')
      if (!orgOp) {
        formatSuccess({ apiUrl: globals.apiUrl, apiKey: '***configured***', org: null })
        return
      }
      const result = await client.request('GET', orgOp.path)
      const data = result.data as any
      const org = data?.org || data
      formatSuccess({
        apiUrl: globals.apiUrl,
        apiKey: '***configured***',
        org: {
          id: org?.id,
          name: org?.companyName,
          domain: org?.domain
        }
      })
    } catch {
      formatSuccess({ apiUrl: globals.apiUrl, apiKey: '***configured***', org: null })
    }
  })

// Built-in commands that require spec fetch
program
  .command('discovery')
  .description('Dump the parsed command tree as JSON')
  .action(async () => {
    try {
      const operations = await fetchAndParseSpec(getSpecOptions())
      formatSuccess(operations)
    } catch (err: any) {
      formatClientError(err.message)
    }
  })

program
  .command('schema <group> <action>')
  .description('Show parameters for a specific command')
  .action(async (group: string, action: string) => {
    try {
      const operations = await fetchAndParseSpec(getSpecOptions())
      const op = operations.find((o) => o.group === group && o.action === action)
      if (!op) {
        formatClientError(`Command not found: ${group} ${action}`)
      }
      formatSuccess({
        group: op!.group,
        action: op!.action,
        method: op!.method.toUpperCase(),
        path: op!.path,
        kind: op!.kind,
        parameters: Object.fromEntries(
          op!.params.map((p) => {
            const info: Record<string, unknown> = { type: p.type, required: p.required, in: p.in }
            if (p.description) info.description = p.description
            if (p.enum) info.enum = p.enum
            return [p.name, info]
          })
        ),
        supportsFilter: op!.supportsFilter
      })
    } catch (err: any) {
      formatClientError(err.message)
    }
  })

// Dynamic API command handler
const apiHandler = async (op: CliOperation, options: Record<string, any>, globals: Record<string, any>) => {
  if (!globals.apiKey) {
    formatClientError('TORII_API_KEY is required. Set it via --api-key or TORII_API_KEY env var.')
  }
  if (!globals.apiUrl) {
    formatClientError('TORII_API_URL is required. Set it via --api-url or TORII_API_URL env var.')
  }

  const client = new ToriiClient({
    apiUrl: globals.apiUrl,
    apiKey: globals.apiKey,
    timeout: parseInt(globals.timeout, 10)
  })

  // Separate path params from query params
  const pathParams: Record<string, string> = {}
  const query: Record<string, string> = {}

  for (const param of op.params) {
    if (param.in === 'path' && options[param.name]) {
      pathParams[param.name] = options[param.name]
    } else if (param.in === 'query' && options[param.name] !== undefined) {
      query[param.name] = String(options[param.name])
    }
  }

  // Merge --filter values
  if (options.filter && Array.isArray(options.filter)) {
    const filters = parseFilters(options.filter)
    Object.assign(query, filters)
  }

  // Parse body
  let body: unknown | undefined
  if (options.payload) {
    try {
      body = JSON.parse(options.payload)
    } catch {
      formatClientError('Invalid JSON in --payload')
    }
  }

  // Dry run
  if (globals.dryRun) {
    const dryRun = client.buildDryRun(op.method.toUpperCase(), op.path, query, pathParams)
    formatDryRun(dryRun.method, dryRun.url, dryRun.headers)
    return
  }

  // File upload
  if (op.kind === 'upload') {
    if (!options.file) {
      return formatClientError('--file <path> is required for upload commands')
    }
    // Collect formData fields (non-file params)
    const formFields: Record<string, string> = {}
    for (const param of op.params) {
      if (param.in === 'formData' && param.type !== 'file' && options[param.name] !== undefined) {
        formFields[param.name] = String(options[param.name])
      }
    }
    const result = await client.uploadFile(op.path, options.file, formFields, pathParams)
    if (result.error) {
      return formatError(result.status, result.error, result.message || '')
    }
    formatSuccess(result.data, { status: result.status })
    return
  }

  // File download
  if (op.kind === 'download') {
    if (!options.output) {
      return formatClientError('--output <path> is required for download commands')
    }
    const result = await client.downloadFile(op.path, options.output, pathParams)
    if (result.error) {
      return formatError(result.status, result.error, result.message || '')
    }
    formatSuccess(result.data, { status: result.status })
    return
  }

  // Pagination
  if (globals.pageAll) {
    const result = await client.requestAllPages(op.method.toUpperCase(), op.path, query, {
      pageLimit: parseInt(globals.pageLimit, 10),
      pageDelay: parseInt(globals.pageDelay, 10)
    })
    if (result.error) {
      formatError(result.error.status, result.error.error, result.error.message || '', result.error.retryAfter)
    }
    formatSuccess(result.items, { pages: result.pages, total: result.total })
    return
  }

  // Normal request
  const result = await client.request(op.method.toUpperCase(), op.path, query, body, pathParams)

  if (result.error) {
    formatError(result.status, result.error, result.message || '', result.retryAfter)
  }

  formatSuccess(result.data, { status: result.status })
}

// Main execution — defers spec fetch until needed
async function main() {
  // Check if user invoked a built-in command (no spec fetch needed)
  const userCommand = process.argv[2]
  // Keep in sync with statically-registered commands above
  const builtInCommands = new Set(['version', 'cache', 'discovery', 'schema', 'whoami', '--version', '-V', '--help', '-h'])

  if (userCommand && !builtInCommands.has(userCommand)) {
    // Dynamic API command — fetch spec and build command tree before parsing
    try {
      const operations = await fetchAndParseSpec(getSpecOptions())
      buildCommandTree(program, operations, apiHandler)
    } catch (err: any) {
      process.stderr.write(`Warning: Failed to load API spec — dynamic commands unavailable: ${err.message}\n`)
    }
  }

  program.parse()
}

main().catch((err) => {
  formatClientError(err.message)
})
