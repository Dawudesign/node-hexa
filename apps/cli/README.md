# node-hexa

> Architecture governance CLI for NestJS — Hexagonal Architecture + DDD + Clean Code + Performance

[![npm](https://img.shields.io/npm/v/@dawudesign/node-hexa-cli)](https://www.npmjs.com/package/@dawudesign/node-hexa-cli)
[![node](https://img.shields.io/node/v/@dawudesign/node-hexa-cli)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/@dawudesign/node-hexa-cli)](./LICENSE)

Node-Hexa automatically enforces Hexagonal Architecture and Domain-Driven Design in NestJS projects. It audits code structure, scores compliance, tracks technical debt over time, and blocks CI when architecture degrades.

---

## Install

```bash
npm install -g @dawudesign/node-hexa-cli
# or
npx @dawudesign/node-hexa-cli audit .
```

Verify:

```bash
node-hexa --version
node-hexa --help
```

---

## Quick Start

```bash
# Create a new NestJS project with Hexagonal DDD structure
node-hexa init my-app
cd my-app

# Audit architecture
node-hexa audit .

# Enforce in CI
node-hexa audit . --fail-under 80 --format ci
```

---

## Commands

| Command | Purpose |
|---|---|
| `init` | Scaffold a new NestJS project with Hexagonal DDD structure |
| `generate` | Add contexts, use cases, aggregates, domain events to an existing project |
| `audit` | Score architecture quality — violations, debt, performance |
| `history` | Show technical debt trend from recorded audit runs |
| `check` | CI pass/fail check — architecture + clean code + green code + performance |
| `analyze` | Full architecture graph, layers, violations, all scores |
| `list` | List bounded contexts and their components |
| `doctor` | Verify local environment readiness |
| `demo` | Generate a demo project with intentional violations |

---

## `init`

Scaffold a new NestJS project with the Node-Hexa folder structure.

```bash
node-hexa init my-app
node-hexa init my-app --template microservice
node-hexa init my-app --template event-driven --ci
```

**Templates:** `api` (default) · `microservice` · `event-driven`

**`--ci`** generates CI pipelines for GitHub Actions and GitLab CI (auto-detects npm vs pnpm).

Generated structure:

```
my-app/
  src/
    contexts/
      iam/                       ← starter bounded context
        domain/
          entities/
          value-objects/
          ports/
          events/
        application/
          use-cases/
        infrastructure/
          persistence/
          http/
    shared/
  node-hexa.config.json
```

---

## `generate`

Add architecture elements to an existing project.

```bash
# New bounded context
node-hexa generate context orders

# Use case inside a context
node-hexa generate usecase create-order orders

# Full aggregate (entity + value object + port + use case + controller + module)
node-hexa generate aggregate product catalog

# Domain event
node-hexa generate event order-placed orders
```

Generated files follow the hexagonal folder conventions automatically.

---

## `audit`

Evaluate architecture quality. Outputs score, violations, technical debt breakdown, and performance analysis.

```bash
node-hexa audit .
```

Example output:

```
Node Hexa Architecture Report

Architecture score: 82/100
Estimated technical debt: 3.1 days

Debt by context:
  orders: 2.3d
  iam: 0.8d

Top violations by debt cost:
  [dependency-direction] 1.5d — Domain must not depend on infrastructure
  [cross-context-coupling] 1.0d — Context 'orders' imports from context 'iam'

DDD compliance: WARNING
Hexagonal boundaries: OK
Dependency violations: WARNING

Detected problems:
- [NXH001][ERROR][DEPENDENCY] Domain must not depend on infrastructure (src/...)
- [NXH012][WARNING][DDD] Context 'orders' is missing a domain port

Recommendations:
- Create domain ports to invert dependencies between application and infrastructure layers.

─── Performance

Performance score: 90/100
  ✓ No performance violations
```

### Options

| Option | Description |
|---|---|
| `--fail-under <n>` | Exit 1 when score is below `n` (default: from config or 0) |
| `--history` | Append this run to `node-hexa-history.jsonl` and show debt trend |
| `--baseline` | Write `node-hexa-baseline.json` |
| `--compare-baseline` | Compare against saved baseline |
| `--format ci` | GitHub Actions / GitLab annotation output |
| `--format sarif` | SARIF 2.1.0 for GitHub Code Scanning |
| `--output json` | Machine-readable JSON (includes debt breakdown + perf data) |
| `--output vscode` | VS Code diagnostic format |
| `--report html` | Generate `node-hexa-report.html` with charts |
| `--badge` | Generate `node-hexa-score.svg` badge |

### JSON output

```bash
node-hexa audit . --output json
```

```json
{
  "score": 82,
  "maxScore": 100,
  "estimatedTechnicalDebtDays": 3.1,
  "debtBreakdown": {
    "total": 3.1,
    "byContext": { "orders": 2.3, "iam": 0.8 },
    "byCategory": { "DEPENDENCY": 1.5, "DDD": 1.6 },
    "topViolations": [
      { "code": "dependency-direction", "debtDays": 1.5, "message": "..." }
    ]
  },
  "perfScore": { "score": 90, "max": 100 },
  "perfViolations": [],
  "qualityGateStatus": "PASS",
  "violations": [...]
}
```

---

## `history`

Show technical debt trend from all recorded audit runs.

```bash
# Record a run
node-hexa audit . --history

# View trend
node-hexa history .
```

Example output:

```
Technical Debt History

  Date                  Score   Debt (d)   Violations
  ─────────────────────────────────────────────────────
  2026-03-20 09:00        75        4.5     12
  2026-03-24 14:30        82        3.1      8
  2026-03-27 08:50        88        1.9      5

  Score trend : ↑ +6 pts vs previous run
  Debt trend  : -1.2d vs previous run
  Worst context  : orders
  Most improved  : iam
```

History is stored in `node-hexa-history.jsonl` (append-only, safe to commit).

---

## `check`

CI-focused pass/fail check across all 4 rule engines.

```bash
node-hexa check .
node-hexa check . --watch    # re-run every 2s
```

Checks:
- Architecture (dependency direction, layer isolation, DDD)
- Clean code (constructor params, method count, file length)
- Green code / eco-design (imports, tree-shaking, GC pressure)
- **Performance** (DI overhead, bloated use cases, large adapters, cross-context fan-out)

Exit codes:
- `0` — all checks passed
- `1` — violations found
- `2` — configuration error

---

## `analyze`

Full breakdown: Mermaid dependency graph, all layer violations, all four scores.

```bash
node-hexa analyze .
```

---

## `list`

List all bounded contexts and their components.

```bash
node-hexa list .
```

```
Bounded Contexts (2)

  ORDERS
    Entities      : OrderEntity
    Value Objects : OrderId, Money
    Ports         : OrderRepositoryPort
    Use Cases     : CreateOrderUseCase
    Domain Events : OrderPlacedDomainEvent

  IAM
    Entities      : UserEntity
    Ports         : UserRepositoryPort
    Use Cases     : CreateUserUseCase
```

---

## `doctor`

Check local environment readiness.

```bash
node-hexa doctor .
```

Checks Node.js version, TypeScript, NestJS presence, and `node-hexa.config.json`.

---

## `demo`

Generate a sample project with intentional violations to explore Node-Hexa.

```bash
node-hexa demo
cd node-hexa-demo
npx @dawudesign/node-hexa-cli audit .
```

---

## Performance Rules

Node-Hexa includes a dedicated performance rule engine targeting NestJS **startup cost** and **runtime overhead**:

| Rule | Trigger | Why it matters |
|---|---|---|
| Heavy DI constructor | `constructorParamCount > 5` | Wide DI trees slow NestJS boot — each extra dep adds transitive resolution cost |
| Bloated use-case | use-case `methodCount > 5` | Use-cases must expose one `execute()` — extra methods load unused code paths eagerly |
| Large infra adapter | infra file `> 500 lines` | Large adapters hold big closures in the V8 heap and slow JIT compilation |
| Cross-context fan-out | imports from `> 2` different contexts | Creates module-loading cascades at startup |

---

## Technical Debt Costs by Rule

Each violation has a calibrated debt cost in engineer-days:

| Rule code | Debt |
|---|---|
| `dependency-direction` | 1.5d |
| `cross-context-coupling` | 1.0d |
| `controller-repository-coupling` | 1.0d |
| `forbidden-dependency` | 1.0d |
| `layer-boundary` | 0.8d |
| `missing-usecase` | 0.8d |
| `missing-port` | 0.5d |
| `missing-entity` | 0.5d |
| `missing-layer-directory` | 0.3d |
| `usecase-name`, `controller-name`, etc. | 0.1d |

---

## CI Integration

### GitHub Actions

```yaml
name: architecture

on: [push, pull_request]

jobs:
  node-hexa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx @dawudesign/node-hexa-cli audit . --fail-under 80 --format ci --history
```

### GitLab CI

```yaml
audit:
  image: node:20
  script:
    - npm ci
    - npx @dawudesign/node-hexa-cli audit . --fail-under 80 --format ci
```

---

## Configuration

`node-hexa.config.json` at the project root:

```json
{
  "architecture": "hexagonal-ddd",
  "strict": true,
  "contextsDir": "src/contexts",
  "qualityGate": {
    "minScore": 80
  }
}
```

TypeScript config (`node-hexa.config.ts`) is also supported.

---

## Typical Workflow

**Local development:**

```bash
node-hexa audit .
node-hexa audit . --history     # track debt over time
```

**Pull request:**

```bash
node-hexa audit . --fail-under 80 --format ci
```

**Main branch:**

```bash
node-hexa audit . --history --compare-baseline
node-hexa history .
```

---

## Links

- [GitHub](https://github.com/Dawudesign/node-hexa)
- [Issues](https://github.com/Dawudesign/node-hexa/issues)
- [npm](https://www.npmjs.com/package/@dawudesign/node-hexa-cli)

---

Node-Hexa helps teams keep architecture clean as projects scale.
