# Contributing to torii-cli

Thanks for your interest in contributing!

## Getting Started

```bash
git clone https://github.com/toriihq/torii-cli.git
cd torii-cli
npm install
npm run build
npm test
```

## Development Workflow

1. Create a feature branch from `master`
2. Make your changes
3. Run `npm run lint` and `npm run lint-types` to check for issues
4. Run `npm test` to verify all tests pass
5. Submit a pull request

## Code Style

This project uses [Biome](https://biomejs.dev/) for formatting and linting:

- No semicolons
- Single quotes
- 2-space indentation
- 120-character line width

Run `npx biome check --write src __tests__` to auto-format.

## Testing

Tests are written with Jest and ts-jest:

```bash
npm test                    # Run all tests
npx jest --watch            # Watch mode
npx jest __tests__/spec     # Run specific test file
```

## Architecture

The CLI is structured as a pipeline:

1. **spec.ts** — Fetches and parses the OpenAPI spec into `CliOperation[]`
2. **commands.ts** — Builds a commander.js command tree from operations
3. **client.ts** — Executes HTTP requests with auth, pagination, upload/download
4. **output.ts** — Formats all output as JSON envelopes to stdout
5. **cache.ts** — Caches the parsed spec for 24 hours

## Reporting Issues

Please open an issue at https://github.com/toriihq/torii-cli/issues with:

- Your Node.js version (`node --version`)
- The command you ran
- Expected vs actual behavior
- Any error output
