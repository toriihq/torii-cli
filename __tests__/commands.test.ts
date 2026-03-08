import { Command } from 'commander'
import { buildCommandTree } from '../src/lib/commands'
import type { CliOperation } from '../src/lib/spec'

describe('buildCommandTree', () => {
  const operations: CliOperation[] = [
    {
      group: 'apps',
      action: 'list',
      method: 'get',
      path: '/v1.0/apps',
      description: 'List applications',
      supportsFilter: true,
      kind: 'json',
      params: [
        { name: 'size', in: 'query', type: 'number', required: false },
        { name: 'cursor', in: 'query', type: 'string', required: false }
      ]
    },
    {
      group: 'apps',
      action: 'get',
      method: 'get',
      path: '/v1.0/apps/{idApp}',
      description: 'Get application',
      supportsFilter: false,
      kind: 'json',
      params: [{ name: 'idApp', in: 'path', type: 'string', required: true }]
    },
    {
      group: 'users',
      action: 'list',
      method: 'get',
      path: '/v1.0/users',
      description: 'List users',
      supportsFilter: false,
      kind: 'json',
      params: [{ name: 'email', in: 'query', type: 'string', required: false }]
    }
  ]

  test('creates subcommands for each group', () => {
    const program = new Command()
    buildCommandTree(program, operations)

    const commandNames = program.commands.map((c) => c.name())
    expect(commandNames).toContain('apps')
    expect(commandNames).toContain('users')
  })

  test('creates action subcommands within groups', () => {
    const program = new Command()
    buildCommandTree(program, operations)

    const appsCmd = program.commands.find((c) => c.name() === 'apps')!
    const actionNames = appsCmd.commands.map((c) => c.name())
    expect(actionNames).toContain('list')
    expect(actionNames).toContain('get')
  })

  test('registers query params as options', () => {
    const program = new Command()
    buildCommandTree(program, operations)

    const appsCmd = program.commands.find((c) => c.name() === 'apps')!
    const listCmd = appsCmd.commands.find((c) => c.name() === 'list')!
    const optionNames = listCmd.options.map((o) => o.long)
    expect(optionNames).toContain('--size')
    expect(optionNames).toContain('--cursor')
  })

  test('registers path params as required options', () => {
    const program = new Command()
    buildCommandTree(program, operations)

    const appsCmd = program.commands.find((c) => c.name() === 'apps')!
    const getCmd = appsCmd.commands.find((c) => c.name() === 'get')!
    const idOption = getCmd.options.find((o) => o.long === '--idApp' || o.long === '--id-app')
    expect(idOption).toBeDefined()
    expect(idOption!.required).toBe(true)
  })

  test('adds --filter option for supportsFilter routes', () => {
    const program = new Command()
    buildCommandTree(program, operations)

    const appsCmd = program.commands.find((c) => c.name() === 'apps')!
    const listCmd = appsCmd.commands.find((c) => c.name() === 'list')!
    const filterOpt = listCmd.options.find((o) => o.long === '--filter')
    expect(filterOpt).toBeDefined()
  })

  test('does not add --filter for non-filter routes', () => {
    const program = new Command()
    buildCommandTree(program, operations)

    const usersCmd = program.commands.find((c) => c.name() === 'users')!
    const listCmd = usersCmd.commands.find((c) => c.name() === 'list')!
    const filterOpt = listCmd.options.find((o) => o.long === '--filter')
    expect(filterOpt).toBeUndefined()
  })

  test('adds --file option for upload operations', () => {
    const program = new Command()
    const uploadOps: CliOperation[] = [
      {
        group: 'files',
        action: 'upload',
        method: 'post',
        path: '/v1.0/files/upload',
        description: 'Upload file',
        supportsFilter: false,
        kind: 'upload',
        params: [
          { name: 'file', in: 'formData', type: 'file', required: true },
          { name: 'type', in: 'formData', type: 'string', required: true }
        ]
      }
    ]
    buildCommandTree(program, uploadOps)

    const filesCmd = program.commands.find((c) => c.name() === 'files')!
    const uploadCmd = filesCmd.commands.find((c) => c.name() === 'upload')!
    const fileOpt = uploadCmd.options.find((o) => o.long === '--file')
    const typeOpt = uploadCmd.options.find((o) => o.long === '--type')
    expect(fileOpt).toBeDefined()
    expect(fileOpt!.required).toBe(true)
    expect(typeOpt).toBeDefined()
  })

  test('adds --output option for download operations', () => {
    const program = new Command()
    const downloadOps: CliOperation[] = [
      {
        group: 'files',
        action: 'download',
        method: 'get',
        path: '/v1.0/files/{id}/download',
        description: 'Download file',
        supportsFilter: false,
        kind: 'download',
        params: [{ name: 'id', in: 'path', type: 'number', required: true }]
      }
    ]
    buildCommandTree(program, downloadOps)

    const filesCmd = program.commands.find((c) => c.name() === 'files')!
    const downloadCmd = filesCmd.commands.find((c) => c.name() === 'download')!
    const outputOpt = downloadCmd.options.find((o) => o.long === '--output')
    expect(outputOpt).toBeDefined()
    expect(outputOpt!.required).toBe(true)
  })
})
