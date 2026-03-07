# node-hexa

> Scaffold and enforce **NestJS Hexagonal DDD** architecture from the command line.

**node-hexa** automates the repetitive parts of clean architecture in NestJS:

- **Scaffold** — generates a full bounded context (entities, ports, use cases, repositories, controllers, NestJS modules) with dependency injection pre-wired, in one command
- **Enforce** — statically analyzes your TypeScript source and reports architecture violations (domain leaking into infrastructure, application bypassing ports, framework imports in domain, etc.)
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
- [Violation rules](#violation-rules)
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
npm install -g @node-hexa/cli
```

Verify:

```bash
node-hexa --version   # 0.1.0
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

# 4. Verify architecture is clean
node-hexa check .
# ✓ Architecture check passed
```

In under 2 minutes you have a running NestJS project with:
- A `iam` bounded context (user entity, repository port, use case, in-memory repository, HTTP controller)
- Full NestJS dependency injection wired
- Architecture rules enforced

---

## Commands

### init

Creates a new NestJS project with the complete Hexagonal DDD structure.

```
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

```
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

```
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

```
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

```
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

```
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

```
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

```
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

Checks that a project contains no architecture violations. Designed for CI/CD — exits `0` if clean, `1` if violations are found, `2` on error.

```
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

**Output — clean project**

```
✓ Architecture check passed
```

**Output — violations detected**

```
✗ Architecture violations detected

  [CRITICAL] Domain must not depend on infrastructure → UserEntity
  [HIGH] Application must not depend on infrastructure → CreateUserUseCase
```

**Exit codes**

| Code | Meaning |
|---|---|
| `0` | No violations |
| `1` | Violations detected |
| `2` | Error (project not found, invalid tsconfig, etc.) |

---

### analyze

Full architecture analysis: layers, violation report, bounded contexts, Mermaid diagram, and score.

```
node-hexa analyze <path>
```

**Example**

```bash
node-hexa analyze .
```

**Output**

```
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
  ✓ User (unknown)
  ✓ UserRepositoryPort (port)

APPLICATION
  ✓ CreateUserUseCase (service)

ADAPTER-IN
  ✓ UserController (controller)

ADAPTER-OUT
  ✓ InMemoryUserRepository (service)

Violations

  ✓ No architecture violations found

Bounded Contexts

IAM
  - User (unknown)
  - UserRepositoryPort (port)
  - CreateUserUseCase (service)
  - UserController (controller)
  - InMemoryUserRepository (service)

Architecture Score

Score: 100/100
```

---

### list

Lists all bounded contexts and their components.

```
node-hexa list <path>
```

**Example**

```bash
node-hexa list .
```

**Output**

```
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

```
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

```
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
| `domain` | `domain/` directory | Pure business logic — no dependencies |
| `application` | `application/` directory | Orchestrates domain via ports |
| `adapter-in` | `http/` or `controller/` directory | Entry points (HTTP, events) |
| `adapter-out` | `persistence/` or `repository/` directory | Output adapters (database, cache) |
| `infrastructure` | `infrastructure/` directory | Everything else technical |

Layer detection uses the **directory path**, not the filename — so `user.repository.port.ts` inside `domain/ports/` is correctly classified as `domain`, not `adapter-out`.

Bounded contexts are detected by reading the directory immediately above `domain/`, `application/`, or `infrastructure/` inside `src/contexts/`.

---

## Violation rules

Three rules are enforced, each with a severity and score penalty:

| Violation | Severity | Penalty |
|---|---|---|
| Domain imports from infrastructure, adapter-in, or adapter-out | `CRITICAL` | −25 pts |
| Domain imports from application | `CRITICAL` | −25 pts |
| Application imports from infrastructure, adapter-in, or adapter-out | `HIGH` | −15 pts |
| Domain imports a framework (`@nestjs/*`, `express`, `prisma`, `mongoose`, `typeorm`) | `CRITICAL` | −25 pts |

Score = `100 − sum of penalties`, minimum 0.

**Strict mode** (`strict: true`, default) — all violations are reported.  
**Non-strict mode** (`strict: false`) — `MEDIUM` violations are filtered out (useful for legacy codebases during migration).

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

Add `node-hexa check` as a step in your pipeline. It exits `1` on violations — which makes the build fail.

**GitHub Actions**

```yaml
# .github/workflows/ci.yml
- name: Architecture check
  run: npx @node-hexa/cli check .
```

Or if installed as a dev dependency:

```yaml
- name: Install dependencies
  run: npm ci

- name: Architecture check
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
| `0` | Clean — no violations | ✓ Pass |
| `1` | Violations detected | ✗ Fail |
| `2` | Error (missing tsconfig, invalid project) | ✗ Fail |

---

## Development

### Project structure

```
node-hexa/
├── packages/
│   ├── model/       ← @node-hexa/model   — TypeScript types (ArchitectureModel, Layer, …)
│   ├── parser/      ← @node-hexa/parser  — ts-morph static analysis
│   ├── rules/       ← @node-hexa/rules   — architecture violation rules + scoring
│   └── core/        ← @node-hexa/core    — generators, analyzer, config loader
├── apps/
│   └── cli/         ← @node-hexa/cli     — commander CLI entry point
├── fixtures/
│   └── test-app/    ← reference NestJS Hexagonal DDD project used in CI
└── node-hexa.config.json
```

### Install and build

```bash
pnpm install
pnpm build        # builds all packages in dependency order
```

### Tests

```bash
pnpm test                        # all packages
pnpm -F @node-hexa/rules test    # unit tests — violation rules
pnpm -F @node-hexa/core test     # integration tests — file generation
```

Tests use [Vitest](https://vitest.dev/). Integration tests create real files in OS temp directories and clean up after themselves.

### Lint

```bash
pnpm lint         # check
pnpm lint:fix     # auto-fix
```

### Local CLI development

```bash
pnpm build
node apps/cli/dist/index.js --help
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

