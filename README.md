# torii-cli

OpenAPI-driven CLI for the [Torii](https://www.toriihq.com) API. Dynamically generates commands from Torii's OpenAPI spec — built for LLM agents and automation.

## Installation

```bash
npm install -g torii-cli
```

Or run directly:

```bash
npx torii-cli discovery
```

## Configuration

| Variable | CLI Flag | Description |
|----------|----------|-------------|
| `TORII_API_KEY` | `--api-key` | API Bearer token (required for API commands) |
| `TORII_API_URL` | `--api-url` | Torii API base URL (required for API commands) |
| `TORII_SPEC_URL` | — | Custom OpenAPI spec URL (optional) |

## Usage

```bash
# List available commands (fetched from OpenAPI spec)
torii-cli discovery

# Show parameters for a command
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

All commands output JSON to stdout:

```json
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
| `discovery` | Dump all parsed commands as JSON |
| `schema <group> <action>` | Show parameters for a command |
| `version` | Show CLI version |
| `cache clear` | Clear the spec cache |

## Global Options

| Option | Default | Description |
|--------|---------|-------------|
| `--api-url <url>` | `$TORII_API_URL` | API base URL |
| `--api-key <key>` | `$TORII_API_KEY` | Bearer token |
| `--timeout <ms>` | `30000` | Request timeout |
| `--page-all` | — | Auto-follow pagination |
| `--page-limit <n>` | `100` | Max pages with --page-all |
| `--page-delay <ms>` | `0` | Delay between pages |
| `--dry-run` | — | Preview request |
| `--no-cache` | — | Skip spec cache |

## Development

```bash
npm install
npm run build     # Compile TypeScript
npm test          # Run tests
npm run lint      # Run biome
```

## Architecture

The CLI fetches Torii's OpenAPI spec at runtime (cached 24h), parses it into operations, builds a commander.js command tree dynamically, executes HTTP requests with Bearer auth, and outputs JSON envelopes to stdout.

```
bin/torii-cli → src/index.ts → spec.ts (fetch + parse)
                             → commands.ts (build tree)
                             → client.ts (HTTP + pagination)
                             → output.ts (JSON envelope)
                             → cache.ts (24h file cache)
```

## License

MIT
