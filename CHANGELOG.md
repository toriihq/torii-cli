# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-08

### Added

- Auto-discovery of API commands from Torii's OpenAPI spec at runtime
- Schema introspection with parameter types, enums, and descriptions
- File upload and download support (multipart/binary)
- Cursor-based and offset-based pagination with `--page-all`
- Dry-run mode (`--dry-run`) for request preview
- 24-hour spec caching with stale fallback on network failure
- Structured JSON envelope output for machine consumption
- `--filter` support for routes with custom fields
- Bearer token authentication via `--api-key` or `TORII_API_KEY`
- Rate limit detection with `retryAfter` in error response
