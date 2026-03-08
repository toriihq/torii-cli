---
name: torii
description: Manage SaaS applications, users, licenses, and integrations via the Torii API
---

## Setup
Requires TORII_API_KEY and TORII_API_URL environment variables.

## Output Format
All commands output JSON to stdout.
- `status` 200 = success (use `data`), 201 = created, 204 = no content
- `status` 429 = rate limited — wait `retryAfter` seconds and retry
- `status` 401/403 = auth error — check API key
- Use `torii-cli discovery` to see all available commands
- Use `torii-cli schema <group> <action>` to see parameters, descriptions, and allowed enum values

## Self-Discovery

**Always start here** — the CLI is self-documenting:

1. `torii-cli discovery` — returns all commands with group, action, method, path, kind, params
2. `torii-cli schema <group> <action>` — returns parameter details including:
   - `type` — parameter data type
   - `required` — whether the parameter is mandatory
   - `description` — human-readable explanation
   - `enum` — list of allowed values (when restricted)
   - `in` — where the param goes: query, path, body, formData
   - `kind` — operation type: json, upload, download

## Commands
- torii-cli apps list — List all applications
- torii-cli apps get --idApp <id> — Get app details
- torii-cli users list — List all users
- torii-cli contracts list — List contracts
- torii-cli integrations list — List connected integrations
- torii-cli files upload --file <path> --type <type> — Upload a file
- torii-cli files download --id <id> --output <path> — Download a file

## Workflows & ID Relationships

IDs returned by one command are inputs to another. Key chains:

| To do this... | First get the ID from... |
|---|---|
| Get app details | `apps list` returns `id` per app -> use as `--idApp` |
| Get app users | `apps list` -> `--idApp` in `applications-users list` |
| Get user apps | `users list` returns `id` -> use as `--idUser` in `user-applications list` |
| Download a file | `files list` or `files create` returns `id` -> use as `--id` in `files download` |
| Upload + download round-trip | `files upload` returns `{ id }` -> use that `id` in `files download` |
| Get contract details | `contracts list` returns `id` -> use as `--id` in `contracts get` |
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
Use --page-all to auto-fetch all pages:
  torii-cli apps list --page-all

Response includes `pages` and `total` counts:
  `{ "data": [...], "status": 200, "pages": 3, "total": 150 }`

## Filtering
Routes that support custom fields accept --filter key=value (repeatable):
  torii-cli apps list --filter "state=discovered" --filter "department=Engineering"

Check `supportsFilter` in `schema` output to know if a command supports this.

## Dry Run
Preview the HTTP request without executing:
  torii-cli apps list --dry-run

## Error Handling
- 429 Too Many Requests: wait `retryAfter` seconds, then retry
- 401 Unauthorized: API key is invalid or missing
- 404 Not Found: the resource ID doesn't exist
- 422 Validation Error: check required params and enum values via `schema`
