---
name: torii
description: Manage SaaS applications, users, licenses, and integrations via the Torii API
---

## How It Works

This CLI is **dynamically generated from Torii's OpenAPI spec**. It fetches the spec at runtime, parses every endpoint, and builds a command for each one. This means:

- **The commands below are examples, not the full list.** The actual commands depend on which API endpoints exist in the spec.
- **New API endpoints automatically become CLI commands** — no CLI update needed.
- **Always run `discovery` first** to see the current, complete command list for your environment.
- The command set may vary between API versions or environments.

## Setup

Requires `TORII_API_KEY` environment variable. `TORII_API_URL` defaults to `https://api.toriihq.com` — only override for local dev.

**Always run `torii-cli whoami` first** to confirm which org and environment you're connected to.

## Output Format

All commands output JSON to stdout.

| Status | Meaning | Action |
|--------|---------|--------|
| 200 | Success | Use `data` field |
| 201 | Created | Use `data` field (contains new resource ID) |
| 204 | No content | Operation succeeded, no data returned |
| 401/403 | Auth error | Check API key |
| 404 | Not found | Resource ID doesn't exist |
| 422 | Validation error | Check required params and enum values via `schema` |
| 429 | Rate limited | Wait `retryAfter` seconds, then retry |

## Self-Discovery

**Always start here** — the CLI is self-documenting:

1. `torii-cli whoami` — shows connected org (id, name, domain) and API environment
2. `torii-cli discovery` — returns all commands with group, action, method, path, kind, params
3. `torii-cli schema <group> <action>` — returns parameter details including:
   - `type` — parameter data type
   - `required` — whether the parameter is mandatory
   - `description` — human-readable explanation
   - `enum` — list of allowed values (when restricted)
   - `in` — where the param goes: query, path, body, formData
   - `kind` — operation type: json, upload, download

## Example Commands

These are common examples. Run `torii-cli discovery` for the full, current list of all available commands.

```bash
torii-cli whoami                                    # Show connected org
torii-cli apps list --size 10                       # List applications
torii-cli apps get --idApp <id>                     # Get app details
torii-cli apps search --q "Slack"                   # Search apps by name
torii-cli users list --size 10                      # List users
torii-cli contracts list                            # List contracts (no --size)
torii-cli roles list                                # List roles
torii-cli audit list --size 10                      # Audit logs
torii-cli applications-users users --idApp <id> --size 10  # App users
torii-cli files upload --file <path> --type <type>  # Upload a file
torii-cli files download --id <id> --output <path>  # Download a file
```

**Note:** Not all commands support `--size`. Use `torii-cli schema <group> <action>` to check available parameters.

## Workflows & ID Relationships

IDs returned by one command are inputs to another. Key chains:

| To do this... | First get the ID from... |
|---|---|
| Get app details | `apps list` returns `id` per app → use as `--idApp` |
| Get app users | `apps list` → `--idApp` in `applications-users list` |
| Get user apps | `users list` returns `id` → use as `--idUser` in `user-applications list` |
| Download a file | `files list` or `files upload` returns `id` → use as `--id` in `files download` |
| Upload + download round-trip | `files upload` returns `{ id }` → use that `id` in `files download` |
| Get contract details | `contracts list` returns `id` → use as `--id` in `contracts get` |
| Get audit logs for entity | `audit list --entity <type>` — entity is an enum, use `schema audit list` to see allowed values |

## File Operations

**Upload** (kind: upload):
```
torii-cli files upload --file /path/to/file.csv --type expenseReport
```
- `--type` is required. Allowed values: `attachment`, `expenseReport`, `customIntegrationData`, `plugin`
- Returns `{ "data": { "id": 33 }, "status": 201 }` — save the `id` for later download

**Download** (kind: download):
```
torii-cli files download --id 33 --output /path/to/save.pdf
```
- `--id` comes from a previous upload, create, or list response
- File is saved to `--output` path. Returns `{ "data": { "file": "<path>", "size": 1234 }, "status": 200 }`

## Pagination

Auto-fetch all pages:
```bash
torii-cli apps list --page-all
```

Response includes `pages` and `total`: `{ "data": [...], "status": 200, "pages": 3, "total": 150 }`

Control with `--page-limit <n>` (max pages, default 100) and `--page-delay <ms>` (delay between requests).

## Filtering

Routes that support custom fields accept `--filter key=value` (repeatable):
```bash
torii-cli apps list --filter "state=discovered" --filter "department=Engineering"
```

Check `supportsFilter` in `schema` output to know if a command supports this.

## Dry Run

Preview the HTTP request without executing:
```bash
torii-cli apps list --dry-run
```

Returns: `{ "dryRun": true, "method": "GET", "url": "...", "headers": { ... } }`

## Error Handling

- **429 Too Many Requests**: wait `retryAfter` seconds, then retry
- **401 Unauthorized**: API key is invalid or missing
- **404 Not Found**: the resource ID doesn't exist
- **422 Validation Error**: check required params and enum values via `schema`

## Presenting Results

When showing results to a user:
1. Parse the JSON output
2. Present data in a readable format (tables, bullet points)
3. For lists, show key identifying fields (id, name, status)
4. For errors, explain what went wrong and suggest a fix
5. If rate limited, wait and retry automatically
