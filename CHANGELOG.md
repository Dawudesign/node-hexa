# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.4.0] — 2026-01-20

### Added

**Architecture rule engine**
- `checkMisplacement` — detects entities/VOs/ports/use-cases/controllers/repository-impls/modules placed in the wrong layer (8 rules, `CRITICAL`/`HIGH`)
- `checkCrossContextImport` — enforces bounded context isolation; cross-context imports are only allowed when targeting a domain port interface
- `checkFrameworkViolations` — extended: ORM packages (`prisma`, `mongoose`, `typeorm`, `mikro-orm`, `sequelize`) now also forbidden in the application layer (`HIGH`)
- `suggestion` field on every `RuleViolation` — actionable `Fix:` guidance shown in CLI output

**Clean Code rule engine** (`runCleanCodeRules`)
- Constructor parameter count > 4 → `HIGH`
- Method count per class > 10 → `MEDIUM`
- Import count per file > 10 → `MEDIUM`
- File length > 200 lines (domain/application) → `MEDIUM`
- File length > 300 lines (infrastructure) → `MEDIUM`

**Green Code / eco-design rule engine** (`runGreenCodeRules`)
- File length > 300 lines → `MEDIUM` (GC pressure)
- Import count > 15 → `MEDIUM` (cold-start cost)
- More than 2 classes per file → `MEDIUM` (tree-shaking)

**Config validation** (`validateConfig`)
- `contextsDir` must exist on disk
- Layer keyword arrays must not be empty
- Same keyword must not appear in two different layer definitions
- Config errors block `check` and cause exit code `2`

**Parser metrics**
- `ParsedClass` now carries `methodCount` and `constructorParamCount`
- `ParsedFile` now carries `lineCount`
- `ArchitectureNode` now carries `metrics?: NodeMetrics` (model package)

**CLI improvements**
- `analyze` — three separate sections (Architecture / Clean Code / Green Code), each with violations and score
- `check` — checks all three rule engines; detailed `File:` + `Fix:` per violation; config errors print and block
- `printConfigIssues()` — surfaces config problems with field name and remediation hint
- Exit messages: `✓ All checks passed (architecture, clean code, green code)` / `✗ <Category> violations (N)`

**Tests**: 59 tests total (up from 25)
- 41 rule tests across 7 suites: `runRules`, `computeScore`, `checkMisplacement`, `checkCrossContextImport`, `application ORM check`, `runCleanCodeRules`, `runGreenCodeRules`
- 18 core integration tests

### Changed
- `analyzeProject` return type extended: `{ model, violations, score, cleanViolations, cleanScore, greenViolations, greenScore, configIssues }`
- `detectKind` priority reordered: name-based detection first, then decorator, then directory location (fixes `@Injectable` overriding use-case/repository detection)
- `detectInterfaceKind` — interface classified as `port` only when name ends `Port` or file lives in a `/ports/` directory (was classifying all interfaces as ports)
- `kindFromLocation` — new fallback: infers kind from `/entities/`, `/value-objects/`, `/use-cases/`, `/ports/` directory names
- `findNodeByImport` — resolves relative imports to absolute paths before matching; non-relative (npm) imports are skipped immediately (eliminates false positives from suffix-only matching)
- `analyzeProject` — synthetic file-level node added for files with no class/interface (ensures all source files are included in analysis)
- `analyzeProject` — `.spec.ts` / `.test.ts` files excluded from analysis

### Fixed
- False-positive architecture violations caused by filename suffix matching across different bounded contexts
- `@Injectable` decorator overriding name-based kind detection (use cases shown as `service`, repositories shown as `service`)
- All interfaces incorrectly classified as `port` (only true ports are now flagged)
- `packages/rules/tsconfig.json` — added `"node"` to `types` array (fixes `node:path` import in declaration output)

---

## [0.3.0] — 2026-01-10

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
