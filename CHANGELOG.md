# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- `CHANGELOG.md` — this file
- `guards.ts` — shared validation module (DRY across all generators)
- `assertInsideProject()` now verifies `@nestjs/core` is present in dependencies (not just any Node project)
- `generate context/usecase/aggregate` — input validation with `assertKebabCase` and `assertInsideProject`
- `generate context` — throws if context already exists
- `generate usecase/aggregate` — throws if target context does not exist
- 6 new validation tests in `integration.spec.ts`
- `--watch` mode for `node-hexa check`
- `check` command returns exit code `0` (clean), `1` (violations), `2` (error) — CI ready

### Changed
- `init` — auto-detects `pnpm` or falls back to `npm`; checks if destination directory already exists; gives actionable error if `@nestjs/cli` bootstrap fails
- `context.ts` — path splitting now uses `path.sep` (cross-platform fix)
- `rules` — `findNodeByImport` uses `endsWith` instead of `includes` to avoid false-positive violations
- `cli` — `--version` reads `npm_package_version` at runtime (stays in sync with `package.json`)
- All generated spec files use `vi.fn()` from Vitest (was incorrectly using `jest.fn()`)
- All `package.json` packages: added `files`, `exports → dist/`, `publishConfig`, `prepublishOnly`

### Fixed
- ESLint: 59 `no-undef` errors from missing Node.js globals
- 21 TypeScript `any` usages replaced with explicit types
- Command injection in `graph.ts` and `init.ts` (array join instead of template strings)
- `config.ts` — `JSON.parse` now validates each field individually, throws on malformed config
- `contextsDir` filtering in `analyzeProject` — uses `path.resolve` + `path.sep` (was fragile string match)

---

## [0.1.0] — 2026-01-01

### Added
- Initial release
- `node-hexa init <name>` — scaffold a new NestJS Hexagonal DDD project
- `node-hexa generate context <name>` — generate a full bounded context
- `node-hexa generate usecase <name> <context>` — generate a use case with DTO + spec
- `node-hexa generate aggregate <name> <context>` — generate a full DDD aggregate
- `node-hexa analyze <path>` — print architecture layers, violations, score
- `node-hexa check <path>` — CI-ready architecture rule checker
- `node-hexa list <path>` — list all bounded contexts and components
- `node-hexa docs <path>` — generate `architecture.md`
- `node-hexa graph <path>` — generate SVG dependency graph
- `node-hexa.config.json` — configurable `strict`, `contextsDir`, `layers`
