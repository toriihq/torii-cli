export enum ExitCode {
  SUCCESS = 0,
  API_ERROR = 1,
  CLIENT_ERROR = 2
}

export function formatSuccess(data: unknown, options?: { pages?: number; total?: number; status?: number }): void {
  const envelope: Record<string, unknown> = { data, status: options?.status ?? 200 }
  if (options?.pages !== undefined) {
    envelope.pages = options.pages
    envelope.total = options.total
  }
  process.stdout.write(`${JSON.stringify(envelope)}\n`)
}

export function formatError(status: number, error: string, message: string, retryAfter?: number): never {
  const envelope: Record<string, unknown> = { error, message, status }
  if (retryAfter !== undefined) {
    envelope.retryAfter = retryAfter
  }
  process.stdout.write(`${JSON.stringify(envelope)}\n`)
  const code = status >= 400 && status < 600 ? ExitCode.API_ERROR : ExitCode.CLIENT_ERROR
  process.exit(code)
}

export function formatDryRun(method: string, url: string, headers: Record<string, string>): void {
  const redacted = { ...headers }
  if (redacted.Authorization) {
    redacted.Authorization = 'Bearer ***redacted***'
  }
  process.stdout.write(`${JSON.stringify({ dryRun: true, method, url, headers: redacted })}\n`)
}

export function formatClientError(message: string): never {
  process.stdout.write(`${JSON.stringify({ error: 'Client Error', message, status: 0 })}\n`)
  process.exit(ExitCode.CLIENT_ERROR)
}
