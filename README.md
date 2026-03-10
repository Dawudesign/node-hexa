# node-hexa

> Scaffold and enforce **NestJS Hexagonal DDD** architecture from the command line.

**node-hexa** automates the repetitive parts of clean architecture in NestJS:

- **Scaffold** — generates a full bounded context (entities, ports, use cases, repositories, controllers, NestJS modules) with dependency injection pre-wired, in one command
- **Enforce** — statically analyzes your TypeScript source and reports architecture violations (domain leaking into infrastructure, application bypassing ports, framework imports in domain, cross-context coupling, misplaced components, etc.)
- **Measure** — checks Clean Code metrics (constructor complexity, method count, file size) and Green Code / eco-design guidelines (memory pressure, cold-start cost, tree-shaking)
- **Document** — exports a Mermaid diagram and architecture report as Markdown or SVG

---

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quickstart](#quickstart)
- [Commands](#commands)
  - [init](#init)
  - [generate context](#generate-context)
  - [generate usecase](#generate-usecase)
  - [generate aggregate](#generate-aggregate)
  - [check](#check)
  - [analyze](#analyze)
  - [list](#list)
  - [docs](#docs)
  - [graph](#graph)
- [Architecture model](#architecture-model)
- [Architecture rules](#architecture-rules)
- [Clean Code rules](#clean-code-rules)
- [Green Code rules](#green-code-rules)
- [Config validation](#config-validation)
- [Configuration](#configuration)
- [CI/CD integration](#cicd-integration)
- [Development](#development)

---

## Requirements

- **Node.js ≥ 20**
- **npm** or **pnpm ≥ 10**

---

## Installation

```bash
npm install -g @dawudesign/node-hexa-cli
```

Verify:

```bash
node-hexa --version   # 0.4.1
node-hexa --help
```

---

## Quickstart

```bash
# 1. Create a new NestJS Hexagonal DDD project
node-hexa init my-app
cd my-app

# 2. Start the server
pnpm start:dev

# 3. Test the generated endpoint
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "name": "Alice"}'

# 4. Verify architecture, clean code, and green code are all clean
node-hexa check .
# ✓ All checks passed (architecture, clean code, green code)
```

In under 2 minutes you have a running NestJS project with:

- A `iam` bounded context (user entity, repository port, use case, in-memory repository, HTTP controller)
- Full NestJS dependency injection wired
- Architecture, clean code and eco-design rules enforced

---

## Commands

### init

Creates a new NestJS project with the complete Hexagonal DDD structure.

```text
node-hexa init <name>
```

**Arguments**

| Argument | Description |
|---|---|
| `<name>` | Project name — lowercase letters, digits, hyphens (e.g. `my-app`) |

**Example**

```bash
node-hexa init my-app
```

**What it does**

1. Runs `npx @nestjs/cli@latest new my-app` (auto-detects pnpm or npm)
2. Replaces the default `src/` with a clean Hexagonal DDD structure
3. Creates `node-hexa.config.json` at the project root

**Generated structure**

```text
my-app/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── shared/
│   └── contexts/
│       └── iam/
│           ├── iam.module.ts
│           ├── domain/
│           │   ├── entities/
│           │   │   └── user.entity.ts
│           │   └── ports/
│           │       └── user.repository.port.ts    ← Symbol DI token + interface
│           ├── application/
│           │   └── use-cases/
│           │       └── create-user.usecase.ts     ← @Inject of the port
│           └── infrastructure/
│               ├── http/
│               │   └── user.controller.ts         ← POST /users
│               └── persistence/
│                   └── in-memory-user.repository.ts
├── node-hexa.config.json
└── package.json
```

**Errors**

| Situation | Message |
|---|---|
| Directory already exists | `Directory "my-app" already exists. Remove it first or choose a different name.` |
| Invalid name | `Invalid project name "MyApp". Use lowercase letters, digits, and hyphens only.` |
| `@nestjs/cli` unavailable | Actionable error with fallback command |

---

### generate context

Generates a complete bounded context inside an existing NestJS project.

```text
node-hexa generate context <name>
```

**Must be run from the root of a NestJS project** (directory that contains a `package.json` with `@nestjs/core` in its dependencies).

**Arguments**

| Argument | Description |
|---|---|
| `<name>` | Context name in kebab-case (e.g. `orders`, `order-line`) |

**Example**

```bash
cd my-app
node-hexa generate context orders
# ✓ Context 'orders' generated at src/contexts/orders/
# → Import OrdersModule in your AppModule to activate it.
```

**Generated files in `src/contexts/orders/`**

```text
orders/
├── orders.module.ts                         ← NestJS module, DI pre-wired
├── domain/
│   ├── entities/
│   │   └── orders.entity.ts
│   ├── value-objects/                       ← empty, ready to add VOs
│   └── ports/
│       └── orders.repository.port.ts        ← Symbol token + interface
├── application/
│   └── use-cases/
│       └── create-orders.usecase.ts         ← @Inject of the port
└── infrastructure/
    ├── http/
    │   └── orders.controller.ts             ← POST /orders
    └── persistence/
        └── in-memory-orders.repository.ts   ← in-memory adapter
```

**Activate in AppModule**

```typescript
// src/app.module.ts
import { OrdersModule } from './contexts/orders/orders.module';

@Module({ imports: [IamModule, OrdersModule] })
export class AppModule {}
```

**Errors**

| Situation | Message |
|---|---|
| Not in a NestJS project | `@nestjs/core not found in dependencies.` |
| Invalid name | `Invalid context name "MyOrders". Use lowercase letters, digits, and hyphens.` |
| Context already exists | `Context 'orders' already exists at src/contexts/orders.` |

---

### generate usecase

Generates a use case with its DTO and Vitest spec file inside an existing bounded context.

```text
node-hexa generate usecase <name> <context>
```

**Arguments**

| Argument | Description |
|---|---|
| `<name>` | Use case name in kebab-case (e.g. `delete-user`, `update-order`) |
| `<context>` | Target bounded context name in kebab-case |

**Example**

```bash
node-hexa generate usecase delete-user iam
# ✓ Use case 'delete-user' generated in context 'iam'
```

**Generated files in `src/contexts/iam/application/use-cases/`**

```text
delete-user.usecase.ts
delete-user.dto.ts
delete-user.usecase.spec.ts
```

**`delete-user.usecase.ts`** — auto-injects the existing repository port if one is found in the context:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY_PORT, UserRepositoryPort } from '../../domain/ports/user.repository.port';
import { DeleteUserUseCaseDto } from './delete-user.dto';

@Injectable()
export class DeleteUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly iamRepository: UserRepositoryPort,
  ) {}

  async execute(dto: DeleteUserUseCaseDto): Promise<void> {
    // TODO: implement use case logic
  }
}
```

**Errors**

| Situation | Message |
|---|---|
| Context does not exist | `Context 'iam' does not exist at src/contexts/iam. Run 'node-hexa generate context iam' first.` |
| Invalid name | `Invalid use case name "DeleteUser". Use lowercase letters, digits, and hyphens.` |

---

### generate aggregate

Generates a complete DDD aggregate inside an existing bounded context: entity, value object, repository port, use case with DTO and Vitest spec, in-memory repository, HTTP controller, and NestJS module.

```text
node-hexa generate aggregate <name> <context>
```

**Arguments**

| Argument | Description |
|---|---|
| `<name>` | Aggregate name in kebab-case (e.g. `product`, `order-line`) |
| `<context>` | Target bounded context name in kebab-case |

**Example**

```bash
node-hexa generate aggregate product catalog
# ✓ Aggregate 'product' generated in context 'catalog' at src/contexts/catalog/
# → Import ProductModule in your CatalogModule or AppModule.
```

**Generated files in `src/contexts/catalog/`**

```text
catalog/
├── product.module.ts
├── domain/
│   ├── entities/
│   │   └── product.entity.ts
│   ├── value-objects/
│   │   └── product-id.vo.ts
│   └── ports/
│       └── product.repository.port.ts
├── application/
│   └── use-cases/
│       ├── create-product.usecase.ts
│       ├── create-product.dto.ts
│       └── create-product.usecase.spec.ts   ← Vitest test with vi.fn() mocks
└── infrastructure/
    ├── http/
    │   └── product.controller.ts
    └── persistence/
        └── in-memory-product.repository.ts
```

**Errors**

| Situation | Message |
|---|---|
| Context does not exist | `Context 'catalog' does not exist. Run 'node-hexa generate context catalog' first.` |
| Invalid name | `Invalid aggregate name "Product". Use lowercase letters, digits, and hyphens.` |

---

### check

Checks that a project contains no architecture, clean code, or green code violations. Designed for CI/CD — exits `0` if all checks pass, `1` if violations are found, `2` on configuration or project errors.

```text
node-hexa check <path> [--watch]
```

**Arguments**

| Argument | Description |
|---|---|
| `<path>` | Path to the project root (must contain `tsconfig.json`) |

**Options**

| Flag | Description |
|---|---|
| `-w, --watch` | Re-run every 2 seconds — useful during development |

**Examples**

```bash
# One-shot check (CI)
node-hexa check .

# Watch mode (development)
node-hexa check . --watch
```

**Output — all checks passed**

```text
✓ All checks passed (architecture, clean code, green code)
```

**Output — violations detected**

```text
✗ Architecture violations (2)

  [CRITICAL] Domain must not depend on infrastructure → UserEntity
    File: src/contexts/iam/domain/entities/user.entity.ts
    Fix:  Extract the infrastructure dependency behind a domain port interface.

  [HIGH] Application must not import infrastructure directly → CreateUserUseCase
    File: src/contexts/iam/application/use-cases/create-user.usecase.ts
    Fix:  Inject the repository through the domain port, not the concrete class.

Architecture Score: 50/100

✗ Clean Code violations (1)

  [HIGH] Constructor has too many parameters (6 > 4) → OrderService
    File: src/contexts/orders/application/order.service.ts
    Fix:  Extract related parameters into a dedicated options object or command DTO.

Clean Code Score: 90/100
```

**Exit codes**

| Code | Meaning |
|---|---|
| `0` | No violations in any category |
| `1` | Violations detected (architecture, clean code, or green code) |
| `2` | Error (config validation failed, project not found, invalid tsconfig) |

---

### analyze

Full analysis report: Mermaid graph, layer breakdown, architecture violations, clean code violations, green code violations, bounded contexts, and config issues.

```text
node-hexa analyze <path>
```

> **Tip:** you can pass the contexts directory directly (`node-hexa analyze src/contexts`) and node-hexa will detect it automatically without a config file.

**Example**

```bash
node-hexa analyze .
# or
node-hexa analyze src/contexts
```

**Output**

```text
Architecture Graph (Mermaid)

flowchart LR

subgraph Domain
  User
  UserRepositoryPort
end

subgraph Application
  CreateUserUseCase
end

subgraph AdapterIn["Adapter In (HTTP)"]
  UserController
end

subgraph AdapterOut["Adapter Out (Persistence)"]
  InMemoryUserRepository
end

DOMAIN
  ✓ User (entity)
  ✓ UserRepositoryPort (port)

APPLICATION
  ✓ CreateUserUseCase (use-case)

ADAPTER-IN
  ✓ UserController (controller)

ADAPTER-OUT
  ✓ InMemoryUserRepository (repository)

── Architecture ─────────────────────────────────────
  ✓ No architecture violations found
Architecture Score: 100/100

── Clean Code ─────────────────────────────────────
  ✓ No clean code violations found
Clean Code Score: 100/100

── Green Code ─────────────────────────────────────
  ✓ No green code violations found
Green Code Score: 100/100

Bounded Contexts

IAM
  - User (entity)
  - UserRepositoryPort (port)
  - CreateUserUseCase (use-case)
  - UserController (controller)
  - InMemoryUserRepository (repository)
```

---

### list

Lists all bounded contexts and their components.

```text
node-hexa list <path>
```

**Example**

```bash
node-hexa list .
```

**Output**

```text
Bounded Contexts (2)

  IAM
    Entities      : user.entity
    Ports         : user.repository.port
    Use Cases     : create-user.usecase

  CATALOG
    Entities      : product.entity
    Value Objects : product-id.vo
    Ports         : product.repository.port
    Use Cases     : create-product.usecase
```

---

### docs

Generates an `architecture.md` file at the project root with the Mermaid diagram, component list, violations, and score.

```text
node-hexa docs <path>
```

**Example**

```bash
node-hexa docs .
# Architecture documentation generated: ./architecture.md
```

The generated file is ready to commit and renders natively on GitHub.

---

### graph

Generates an `architecture.svg` file with the full dependency graph (requires `mmdc` from `@mermaid-js/mermaid-cli`).

```text
node-hexa graph <path>
```

**Example**

```bash
npm install -g @mermaid-js/mermaid-cli
node-hexa graph .
# Architecture graph generated: ./architecture.svg
```

---

## Architecture model

node-hexa understands 5 layers:

| Layer | Match keywords | Role |
|---|---|---|
| `domain` | `domain/` directory | Pure business logic — no external dependencies |
| `application` | `application/` directory | Orchestrates domain via ports |
| `adapter-in` | `http/` or `controller/` directory | Entry points (HTTP, events, CLI) |
| `adapter-out` | `persistence/` or `repository/` directory | Output adapters (database, cache, external APIs) |
| `infrastructure` | `infrastructure/` directory | Cross-cutting technical concerns |

Layer detection uses the **directory path**, not the filename — so `user.repository.port.ts` inside `domain/ports/` is correctly classified as `domain`, not `adapter-out`.

Component kind is detected in priority order:

1. **Name pattern** — file/class name contains `UseCase`, `Entity`, `Repository`, `Controller`, `Port`, `Vo`/`ValueObject`/`Value-Object`, `Module`
2. **Decorator** — `@Injectable()`, `@Controller()`, `@Module()`
3. **Directory (known layer folder)** — file lives inside `/entities/`, `/value-objects/`, `/use-cases/`, `/ports/`
4. **Directory (infrastructure folder)** — file lives inside `/persistence/`, `/repository/`, `/repositories/` → `repository`; `/http/`, `/controllers/`, `/rest/`, `/graphql/` → `controller`

This means a class named `UserDataAccess` placed under `domain/persistence/` is still correctly identified as a repository implementation and caught by misplacement rules, even though its name doesn't match the `*Repository` pattern.

Bounded contexts are detected by reading the directory immediately above `domain/`, `application/`, or `infrastructure/` inside `contextsDir` (`src/contexts/` by default).

---

## Architecture rules

All violations include a **suggestion** (`Fix:`) explaining how to resolve the issue.

### Layer violation rules

| Violation | Severity | Score penalty |
|---|---|---|
| Domain imports from infrastructure, adapter-in, or adapter-out | `CRITICAL` | −25 pts |
| Domain imports from application | `CRITICAL` | −25 pts |
| Application imports from infrastructure, adapter-in, or adapter-out | `HIGH` | −15 pts |

### Framework pollution rules

| Violation | Severity | Score penalty |
|---|---|---|
| Domain imports a framework (`@nestjs/*`, `express`, `prisma`, `mongoose`, `typeorm`, `mikro-orm`, `sequelize`) | `CRITICAL` | −25 pts |
| Application imports an ORM (`prisma`, `mongoose`, `typeorm`, `mikro-orm`, `sequelize`) | `HIGH` | −15 pts |

### Misplacement rules

These rules catch components placed in the wrong layer:

| Violation | Severity | Score penalty |
|---|---|---|
| Entity or Value Object not in `domain/` | `HIGH` | −15 pts |
| Port (interface) not in `domain/` | `HIGH` | −15 pts |
| Use case not in `application/` | `HIGH` | −15 pts |
| Controller found in `domain/` or `application/` | `CRITICAL` | −25 pts |
| Repository implementation in `domain/` | `CRITICAL` | −25 pts |

> **Tip:** misplacement is detected by directory path, not just class name. A class named `UserDataAccess` in `domain/persistence/` is just as flagged as one named `UserRepository`.
| NestJS module in `domain/` or `application/` | `HIGH` | −15 pts |

### Cross-context isolation rules

Each bounded context must be self-contained. Direct imports between contexts are forbidden unless the target is a **domain port** interface (which acts as the published API of the context).

| Violation | Severity | Score penalty |
|---|---|---|
| Component imports directly from another bounded context's non-port code | `HIGH` | −15 pts |

**Example violation:**

```text
[HIGH] Cross-context import: 'orders' imports from 'iam' → CreateOrderUseCase
  File: src/contexts/orders/application/use-cases/create-order.usecase.ts
  Fix:  Only import domain ports from other contexts. Use an anti-corruption layer or shared kernel for cross-context communication.
```

**Allowed cross-context pattern:**

```typescript
// ✓ OK — importing a port (published interface) from another context
import { UserRepositoryPort } from '../../iam/domain/ports/user.repository.port';

// ✗ Forbidden — importing a concrete implementation from another context
import { InMemoryUserRepository } from '../../iam/infrastructure/persistence/in-memory-user.repository';
```

Score = `100 − sum of penalties`, minimum 0.

**Strict mode** (`strict: true`, default) — all violations are reported.  
**Non-strict mode** (`strict: false`) — `MEDIUM` violations are filtered out (useful for legacy codebases during migration).

---

## Clean Code rules

These rules measure structural code quality. Violations are reported separately from architecture violations with their own score.

| Rule | Threshold | Severity | Score penalty |
|---|---|---|---|
| Constructor has too many parameters | > 4 params | `HIGH` | −15 pts |
| Class has too many methods | > 10 methods | `MEDIUM` | −10 pts |
| File has too many imports | > 10 imports | `MEDIUM` | −10 pts |
| Domain / application file too long | > 200 lines | `MEDIUM` | −10 pts |
| Infrastructure file too long | > 300 lines | `MEDIUM` | −10 pts |

**Example violations:**

```text
[HIGH] Constructor has too many parameters (6 > 4) → OrderService
  Fix:  Extract related parameters into a dedicated options object or command DTO.

[MEDIUM] Class has too many methods (14 > 10) → UserController
  Fix:  Split the class into smaller, focused controllers or use a router pattern.

[MEDIUM] File has too many imports (12 > 10) → CreateOrderUseCase
  Fix:  Consider grouping related imports via barrel exports or splitting the file.
```

---

## Green Code rules

These rules apply **eco-design** guidelines to minimize runtime resource consumption. They target memory pressure (GC), cold-start time (module loading), and bundle size (tree-shaking).

| Rule | Threshold | Severity | Why it matters |
|---|---|---|---|
| File has too many lines | > 300 lines | `MEDIUM` | Large files increase GC pressure during module loading |
| File has too many imports | > 15 imports | `MEDIUM` | Each import adds cold-start cost; reduce coupling |
| Too many classes per file | > 2 classes | `MEDIUM` | Bundlers cannot tree-shake unused exports from dense files |

**Example violations:**

```text
[MEDIUM] File is too long (350 lines > 300) → user.repository.ts
  Fix:  Split this file into smaller modules to reduce GC pressure during module loading.

[MEDIUM] Too many classes in one file (3 > 2) → order.module.ts
  Fix:  One class per file improves tree-shaking and readability.
```

---

## Config validation

`node-hexa check` validates `node-hexa.config.json` before running any rules. Configuration errors cause the command to exit `2` immediately.

| Check | What it verifies |
|---|---|
| `contextsDir` exists | The configured bounded contexts directory exists on disk |
| Layer keywords not empty | Each layer must have at least one detection keyword |
| No keyword overlap | The same keyword cannot match two different layers |

**Example config error output:**

```text
✗ Config issues detected — fix before running checks

  [ERROR] contextsDir 'src/contexts' does not exist.
    Field: contextsDir
    Fix:   Create the directory or update 'contextsDir' in node-hexa.config.json.

  [WARNING] Layer keyword 'domain' appears in both 'domain' and 'application'.
    Field: layers
    Fix:   Ensure each keyword maps to exactly one layer.
```

---

## Configuration

`node-hexa init` creates `node-hexa.config.json` at the project root. All keys are optional — missing keys fall back to defaults.

```json
{
  "architecture": "hexagonal-ddd",
  "strict": true,
  "contextsDir": "src/contexts"
}
```

| Key | Type | Default | Description |
|---|---|---|---|
| `architecture` | `"hexagonal-ddd"` | required | Architecture type — currently only `hexagonal-ddd` |
| `strict` | `boolean` | `true` | `false` silences `MEDIUM` violations |
| `contextsDir` | `string` | `"src/contexts"` | Path to bounded contexts directory. Relative to project root |

**Custom layer keywords** — override which directory names map to which layer:

```json
{
  "architecture": "hexagonal-ddd",
  "strict": true,
  "contextsDir": "src/contexts",
  "layers": {
    "domain": ["domain", "core"],
    "application": ["application", "app"],
    "adapterIn": ["http", "rest", "controller", "graphql"],
    "adapterOut": ["persistence", "repository", "database"]
  }
}
```

Only list the keys you want to override — unlisted keys keep their defaults.

---

## CI/CD integration

Add `node-hexa check` as a step in your pipeline. It exits `1` on violations and `2` on config errors — both fail the build.

**GitHub Actions**

```yaml
# .github/workflows/ci.yml
- name: Architecture + quality check
  run: npx @dawudesign/node-hexa-cli check .
```

Or if installed as a dev dependency:

```yaml
- name: Install dependencies
  run: npm ci

- name: Architecture + quality check
  run: npx node-hexa check .
```

**npm script**

```json
{
  "scripts": {
    "arch:check": "node-hexa check .",
    "arch:watch": "node-hexa check . --watch"
  }
}
```

Then in CI:

```yaml
- run: npm run arch:check
```

**Exit codes summary**

| Code | Meaning | CI result |
|---|---|---|
| `0` | All checks passed (architecture + clean code + green code) | ✓ Pass |
| `1` | Violations detected | ✗ Fail |
| `2` | Error (config invalid, missing tsconfig, project not found) | ✗ Fail |

---

## Development

### Project structure

```text
node-hexa/
├── packages/
│   ├── model/       ← @node-hexa/model   — TypeScript types (ArchitectureModel, Layer, NodeMetrics, …)
│   ├── parser/      ← @node-hexa/parser  — ts-morph static analysis (parses classes, methods, metrics)
│   ├── rules/       ← @node-hexa/rules   — rule engines (architecture, clean code, green code)
│   └── core/        ← @node-hexa/core    — generators, analyzer, config loader + validator
├── apps/
│   └── cli/         ← @dawudesign/node-hexa-cli — commander CLI entry point
├── fixtures/
│   └── test-app/    ← reference NestJS Hexagonal DDD project used in CI
└── node-hexa.config.json
```

### Install and build

```bash
pnpm install
pnpm -r build        # builds all packages in dependency order
```

### Tests

```bash
pnpm -r test                       # all packages (61 tests)
pnpm -F @node-hexa/rules test      # unit tests — violation rules
pnpm -F @node-hexa/core test       # integration tests — file generation
```

Tests use [Vitest](https://vitest.dev/). Integration tests create real files in OS temp directories and clean up after themselves.

### Lint

```bash
pnpm lint         # check
pnpm lint:fix     # auto-fix
```

### Local CLI development

```bash
pnpm -r build
node apps/cli/dist/index.js --help
node apps/cli/dist/index.js analyze fixtures/test-app
node apps/cli/dist/index.js check fixtures/test-app
```

Or link globally:

```bash
cd apps/cli && npm link
node-hexa check fixtures/test-app
```

### CI

GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs on every push and pull request to `main` and `develop`:

1. **Build & Test** — matrix Node 20 + 22 — `pnpm install → pnpm build → pnpm test`
2. **Architecture Check** — `node-hexa check fixtures/test-app` — validates the CLI works end-to-end on a real NestJS project


---

