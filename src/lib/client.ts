import * as fs from 'fs'
import * as path from 'path'

export interface ClientConfig {
  apiUrl: string
  apiKey: string
  timeout: number
}

interface ApiResponse {
  status: number
  data?: unknown
  error?: string
  message?: string
  retryAfter?: number
}

interface PaginationResult {
  items: unknown[]
  pages: number
  total: number
  error?: { status: number; error: string; message?: string; retryAfter?: number }
}

interface PaginationOptions {
  pageLimit: number
  pageDelay: number
}

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  429: 'Too Many Requests',
  500: 'Internal Server Error'
}

export class ToriiClient {
  private config: ClientConfig

  constructor(config: ClientConfig) {
    this.config = config
  }

  private buildUrl(path: string, query?: Record<string, string>, pathParams?: Record<string, string>): string {
    let resolvedPath = path
    if (pathParams) {
      for (const [key, value] of Object.entries(pathParams)) {
        resolvedPath = resolvedPath.replace(`{${key}}`, encodeURIComponent(value))
      }
    }

    const url = new URL(resolvedPath, this.config.apiUrl)
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== '') {
          url.searchParams.set(key, value)
        }
      }
    }
    return url.toString()
  }

  private buildHeaders(hasBody: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`
    }
    if (hasBody) {
      headers['Content-Type'] = 'application/json'
    }
    return headers
  }

  buildDryRun(
    method: string,
    path: string,
    query?: Record<string, string>,
    pathParams?: Record<string, string>
  ): {
    method: string
    url: string
    headers: Record<string, string>
  } {
    return {
      method,
      url: this.buildUrl(path, query, pathParams),
      headers: this.buildHeaders(false)
    }
  }

  async request(
    method: string,
    path: string,
    query?: Record<string, string>,
    body?: unknown,
    pathParams?: Record<string, string>
  ): Promise<ApiResponse> {
    const url = this.buildUrl(path, query, pathParams)
    const headers = this.buildHeaders(!!body)

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.config.timeout)
      })

      const data: any = await response.json().catch(() => null)

      if (!response.ok) {
        const retryAfter = response.headers.get('Retry-After')
        return {
          status: response.status,
          error: STATUS_TEXT[response.status] || 'Error',
          message: data?.message || data?.error || response.statusText,
          ...(retryAfter ? { retryAfter: parseInt(retryAfter, 10) } : {})
        }
      }

      return { status: response.status, data }
    } catch (err: any) {
      if (err.name === 'TimeoutError') {
        return { status: 0, error: 'Timeout', message: `Request timed out after ${this.config.timeout}ms` }
      }
      return { status: 0, error: 'Network Error', message: err.message }
    }
  }

  async requestAllPages(
    method: string,
    path: string,
    query?: Record<string, string>,
    options?: PaginationOptions
  ): Promise<PaginationResult> {
    const { pageLimit = 100, pageDelay = 0 } = options || {}
    const allItems: unknown[] = []
    let pages = 0
    let total = 0
    let currentQuery = { ...query }

    while (pages < pageLimit) {
      const response = await this.request(method, path, currentQuery)
      pages++

      if (response.error || response.status !== 200 || !response.data) {
        return {
          items: allItems,
          pages,
          total: total || allItems.length,
          error: response.error
            ? {
                status: response.status,
                error: response.error,
                message: response.message,
                retryAfter: response.retryAfter
              }
            : undefined
        }
      }

      const data = response.data as Record<string, unknown>
      total = (data.total as number) || total

      // Find the array-valued key in the response
      const arrayKey = Object.keys(data).find((k) => Array.isArray(data[k]))
      if (!arrayKey) break

      const items = data[arrayKey] as unknown[]
      allItems.push(...items)

      // Cursor-based pagination
      if (data.nextCursor) {
        currentQuery = { ...currentQuery, cursor: data.nextCursor as string }
        if (pageDelay > 0) await new Promise((r) => setTimeout(r, pageDelay))
        continue
      }

      // Offset-based pagination
      if (data.total && allItems.length < (data.total as number)) {
        const currentOffset = parseInt(currentQuery.offset || '0', 10)
        const limit = parseInt(currentQuery.limit || '50', 10)
        currentQuery = { ...currentQuery, offset: String(currentOffset + limit) }
        if (pageDelay > 0) await new Promise((r) => setTimeout(r, pageDelay))
        continue
      }

      // No more pages
      break
    }

    return { items: allItems, pages, total: total || allItems.length }
  }

  async uploadFile(
    apiPath: string,
    filePath: string,
    formFields: Record<string, string>,
    pathParams?: Record<string, string>
  ): Promise<ApiResponse> {
    const url = this.buildUrl(apiPath, undefined, pathParams)

    try {
      const fileBuffer = fs.readFileSync(filePath)
      const fileName = path.basename(filePath)
      const blob = new Blob([fileBuffer])

      const formData = new FormData()
      // Add non-file fields first
      for (const [key, value] of Object.entries(formFields)) {
        formData.append(key, value)
      }
      formData.append('file', blob, fileName)

      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        body: formData,
        signal: AbortSignal.timeout(this.config.timeout)
      })

      const data: any = await response.json().catch(() => null)

      if (!response.ok) {
        return {
          status: response.status,
          error: STATUS_TEXT[response.status] || 'Error',
          message: data?.message || data?.error || response.statusText
        }
      }

      return { status: response.status, data }
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return { status: 0, error: 'File Not Found', message: `File not found: ${filePath}` }
      }
      if (err.name === 'TimeoutError') {
        return { status: 0, error: 'Timeout', message: `Upload timed out after ${this.config.timeout}ms` }
      }
      return { status: 0, error: 'Network Error', message: err.message }
    }
  }

  async downloadFile(apiPath: string, outputPath: string, pathParams?: Record<string, string>): Promise<ApiResponse> {
    const url = this.buildUrl(apiPath, undefined, pathParams)

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        signal: AbortSignal.timeout(this.config.timeout)
      })

      if (!response.ok) {
        const data: any = await response.json().catch(() => null)
        return {
          status: response.status,
          error: STATUS_TEXT[response.status] || 'Error',
          message: data?.message || data?.error || response.statusText
        }
      }

      const buffer = Buffer.from(await response.arrayBuffer())
      fs.mkdirSync(path.dirname(outputPath), { recursive: true })
      fs.writeFileSync(outputPath, buffer)

      return {
        status: response.status,
        data: { file: outputPath, size: buffer.length }
      }
    } catch (err: any) {
      if (err.name === 'TimeoutError') {
        return { status: 0, error: 'Timeout', message: `Download timed out after ${this.config.timeout}ms` }
      }
      return { status: 0, error: 'Network Error', message: err.message }
    }
  }
}
