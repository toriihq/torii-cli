import { Command } from 'commander'
import type { CliOperation, CliParam } from './spec'

type ActionHandler = (
  operation: CliOperation,
  options: Record<string, any>,
  globals: Record<string, any>
) => Promise<void>

export function buildCommandTree(program: Command, operations: CliOperation[], handler?: ActionHandler): void {
  // Group operations by group name
  const groups = new Map<string, CliOperation[]>()
  for (const op of operations) {
    if (!groups.has(op.group)) groups.set(op.group, [])
    groups.get(op.group)!.push(op)
  }

  for (const [groupName, ops] of groups) {
    const groupCmd = program.command(groupName).description(`${groupName} commands`)

    for (const op of ops) {
      const actionCmd = groupCmd.command(op.action).description(op.description)

      // Register params as options
      for (const param of op.params) {
        if (param.in === 'body') {
          actionCmd.option('--payload <json>', param.description || 'JSON request body')
          continue
        }
        if (param.in === 'formData' && param.type === 'file') {
          // File params are handled by --file flag below
          continue
        }

        const flag = `--${param.name} <value>`
        if (param.required) {
          actionCmd.requiredOption(flag, param.description || '')
        } else {
          actionCmd.option(flag, param.description || '')
        }
      }

      // Add --file for upload operations
      if (op.kind === 'upload') {
        actionCmd.requiredOption('--file <path>', 'Local file path to upload')
      }

      // Add --output for download operations
      if (op.kind === 'download') {
        actionCmd.requiredOption('--output <path>', 'Local file path to save download')
      }

      // Add --filter for routes that support it
      if (op.supportsFilter) {
        actionCmd.option('--filter <key=value>', 'Filter by key=value (repeatable)', collect, [])
      }

      if (handler) {
        actionCmd.action(async (options: Record<string, any>) => {
          const globals = program.opts()
          await handler(op, options, globals)
        })
      }
    }
  }
}

function collect(value: string, previous: string[]): string[] {
  return previous.concat([value])
}

export function parseFilters(filters: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const f of filters) {
    const eqIndex = f.indexOf('=')
    if (eqIndex === -1) continue
    const key = f.slice(0, eqIndex)
    const value = f.slice(eqIndex + 1)
    result[key] = value
  }
  return result
}
