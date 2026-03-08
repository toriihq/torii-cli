# torii-cli

[![CI](https://github.com/toriihq/torii-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/toriihq/torii-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/torii-cli.svg)](https://www.npmjs.com/package/torii-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

OpenAPI-driven CLI for the [Torii](https://www.toriihq.com) API. Dynamically generates commands from Torii's OpenAPI spec — built for LLM agents and automation.

## Prerequisites

You need a **Torii account** with API access:

1. Log in to your [Torii dashboard](https://app.toriihq.com/team/)
2. Go to **Settings → API** to generate an API key
3. Your API base URL is `https://api.toriihq.com`

See the [Torii API documentation](https://developers.toriihq.com) for full details.

## Installation

```bash
npm install -g torii-cli
```

Or run directly with npx:

```bash
npx torii-cli discovery
```

## Quick Start

```bash
# Set your credentials
export TORII_API_KEY="your-api-key"
export TORII_API_URL="https://api.toriihq.com"

# Discover all available commands
torii-cli discovery

# List your applications
torii-cli apps list --size 10
```

## Configuration

| Variable | CLI Flag | Description |
|----------|----------|-------------|
| `TORII_API_KEY` | `--api-key` | API Bearer token **(required)** |
| `TORII_API_URL` | `--api-url` | Torii API base URL **(required)** |
| `TORII_SPEC_URL` | — | Custom OpenAPI spec URL (optional, defaults to Torii's public spec) |

## Usage

```bash
# List available commands (fetched from OpenAPI spec)
torii-cli discovery

# Show parameters for a command (types, enums, descriptions)
torii-cli schema apps list

# List applications
torii-cli apps list --size 10

# Get a specific app
torii-cli apps get --idApp <id>

# Auto-paginate all results
torii-cli apps list --page-all

# Preview request without executing
torii-cli apps list --dry-run

# Upload a file
torii-cli files upload --file ./report.csv --type expenseReport

# Download a file
torii-cli files download --id 42 --output ./downloaded.csv

# Filter (for routes supporting custom fields)
torii-cli apps list --filter "state=discovered"
```

## Output Format

All commands output structured JSON to stdout, making it easy to pipe into `jq`, scripts, or LLM agents:

```jsonc
// Success
{ "data": { ... }, "status": 200 }

// Paginated
{ "data": [...], "status": 200, "pages": 3, "total": 150 }

// Error
{ "error": "Unauthorized", "message": "Invalid API key", "status": 401 }

// Rate limited
{ "error": "Too Many Requests", "status": 429, "retryAfter": 30 }

// Dry run
{ "dryRun": true, "method": "GET", "url": "...", "headers": { ... } }
```

## Built-in Commands

| Command | Description |
|---------|-------------|
| `discovery` | List all available API commands as JSON |
| `schema <group> <action>` | Show parameters, types, and enums for a command |
| `version` | Show CLI version |
| `cache clear` | Clear the cached OpenAPI spec |

## Global Options

| Option | Default | Description |
|--------|---------|-------------|
| `--api-url <url>` | `$TORII_API_URL` | API base URL |
| `--api-key <key>` | `$TORII_API_KEY` | Bearer token |
| `--timeout <ms>` | `30000` | Request timeout |
| `--page-all` | — | Auto-follow pagination |
| `--page-limit <n>` | `100` | Max pages with --page-all |
| `--page-delay <ms>` | `0` | Delay between pages |
| `--dry-run` | — | Preview request without executing |
| `--no-cache` | — | Skip spec cache and fetch fresh |

## For LLM Agents

This CLI is designed for machine consumption. The self-discovery workflow:

```bash
# 1. Discover all commands
torii-cli discovery | jq '.data[] | {group, action, kind}'

# 2. Get parameter schema for a specific command
torii-cli schema apps list | jq '.data.parameters'

# 3. Execute with structured output
torii-cli apps list --size 5 | jq '.data'
```

All output goes to stdout as JSON. Errors and warnings go to stderr. Exit codes: `0` = success, `1` = API error, `2` = client error.

## Development

```bash
git clone https://github.com/toriihq/torii-cli.git
cd torii-cli
npm install
npm run build     # Compile TypeScript
npm test          # Run tests (50 tests across 6 suites)
npm run lint      # Run biome
```

## Architecture

The CLI fetches Torii's OpenAPI spec at runtime (cached 24h), parses it into operations, builds a commander.js command tree dynamically, executes HTTP requests with Bearer auth, and outputs JSON envelopes to stdout.

```
bin/torii-cli → src/index.ts → spec.ts (fetch + parse OpenAPI spec)
                             → commands.ts (build commander.js tree)
                             → client.ts (HTTP + pagination + upload/download)
                             → output.ts (JSON envelope formatting)
                             → cache.ts (24h file cache with stale fallback)
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](LICENSE)
