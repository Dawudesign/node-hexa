# Node Hexa

Architecture governance CLI for TypeScript projects (Hexagonal Architecture + DDD + Clean Code + Performance)

Node-Hexa automatically enforces Hexagonal Architecture and DDD in TypeScript projects — NestJS, Express, Fastify, or any TypeScript backend — to prevent architecture drift.

## Command Cheat Sheet

| Command | Purpose |
|---|---|
| `audit` | Analyze architecture quality — score, violations, debt breakdown |
| `history` | Show technical debt trend from audit history |
| `init` | Create a NestJS project scaffold with Node-Hexa structure |
| `generate` | Scaffold contexts, use cases, aggregates, domain events |
| `check` | Validate architecture, clean code, and green code rules for CI |
| `doctor` | Check local environment readiness |
| `demo` | Generate a demo project with good and bad patterns |
| `list` | List all bounded contexts and their components |

## Example Architecture Enforced

```text
src/
  contexts/
    orders/
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
```

## Problem

NestJS projects often start with clean structure and clear boundaries.

Over time, architecture degrades:

- dependency direction is violated
- domain and infrastructure get coupled
- architecture rules are not enforced consistently
- reviews are manual and subjective

Node-Hexa prevents this drift by making architecture checks explicit, repeatable, and automatable.

## Why Not Just ESLint?

- ESLint focuses on code quality and style at file/code-pattern level.
- Node-Hexa focuses on architecture quality across layers, contexts, and dependency direction.

Both are complementary: ESLint helps keep code clean, Node-Hexa helps keep architecture clean.

## When Should You Use Node-Hexa?

Use Node-Hexa if:

- you use DDD / Hexagonal Architecture in a TypeScript project (NestJS, Express, Fastify, Next.js API routes…)
- you want enforceable architecture rules
- you want CI architecture checks and score thresholds
- you want technical debt tracked per bounded context over time

## When Not to Use It

Node-Hexa is usually not useful for:

- very small scripts
- throwaway prototypes
- projects that are not organized around DDD/architecture boundaries (no domain/application/infrastructure layers)

## Using Node-Hexa on an Existing Project

If your project already has a hexagonal structure but with a custom folder layout, create `node-hexa.config.json` at the root:

```json
{
  "architecture": "hexagonal-ddd",
  "contextsDir": "src",
  "strict": false
}
```

With `"contextsDir": "src"`, Node-Hexa looks for contexts directly under `src/` (e.g. `src/notification`, `src/payment`). Node-Hexa auto-detects the actual context roots from scanned files, so even without config it will find the right structure.

To skip rules that don't apply to your stack:

```json
{
  "architecture": "hexagonal-ddd",
  "contextsDir": "src/modules",
  "ignoredRules": ["NXH010", "NXH009"]
}
```

## What Node-Hexa Does

- Generate clean architecture project scaffolding
- Audit architecture quality with a score and rule violations
- Detect boundary and dependency violations
- Enforce clean code and green code rules
- Detect performance anti-patterns (startup cost, DI overhead, infra bloat)
- Estimate technical debt per rule and per bounded context
- Track debt history and show improvement trends
- Enforce architecture standards in CI

## Quick Example

```bash
node-hexa audit .
```

Example output:

```text
Node Hexa Architecture Report

Architecture score: 60/100
Estimated technical debt: 1.5 days

Debt by context:
  orders: 1.0d
  iam: 0.5d

Top violations by debt cost:
  [dependency-direction] 1.5d — Domain must not depend on infrastructure (src/contexts/orders/...)
  [cross-context-coupling] 1.0d — Context 'orders' imports from context 'iam' (...)

DDD compliance: ERROR
Hexagonal boundaries: ERROR
Dependency violations: ERROR

Detected problems:
- [NXH001][ERROR][DEPENDENCY] Domain must not depend on infrastructure
- [NXH012][ERROR][DDD] Context 'bad' has no domain port

Recommendations:
- Create domain ports to invert dependencies between application and infrastructure layers.
- Enforce inward dependency flow: infrastructure -> application -> domain through ports and interfaces.
```

## Installation

```bash
npm install -g @dawudesign/node-hexa-cli
```

Verify:

```bash
node-hexa --version
node-hexa --help
```

## Quick Start

```bash
node-hexa init my-app
cd my-app
node-hexa audit .
```

What happens:

- `init` scaffolds a NestJS project with Hexagonal DDD folder structure and starter context
- `audit` analyzes architecture and outputs score, violations, recommendations, and technical debt

Expected result:

- You should see an architecture score and violation report.

## Core Commands

### init

Purpose: scaffold a new NestJS project with Node-Hexa structure.

```bash
node-hexa init my-app --template api --ci
```

Templates: `api` (default), `microservice`, `event-driven`

Output:

- project created with Hexagonal DDD folder structure
- architecture config (`node-hexa.config.json`) generated
- optional CI templates (`.github/workflows/node-hexa.yml`, `.gitlab-ci.yml`) for npm or pnpm

### generate

Purpose: generate architecture elements inside an existing project.

```bash
# Generate a bounded context
node-hexa generate context orders

# Generate a use case inside a context
node-hexa generate usecase create-order orders

# Generate an aggregate (entity + VO + port + use case + controller + module)
node-hexa generate aggregate product catalog

# Generate a domain event
node-hexa generate event order-placed orders
```

Arguments:
- `context`: `<name>`
- `usecase`: `<name> <context>`
- `aggregate`: `<name> <context>`
- `event`: `<name> <context>`

Missing `<context>` for usecase, aggregate, or event produces a clear error message.

### audit

Purpose: evaluate architecture quality and produce governance outputs.

```bash
node-hexa audit .
```

Output:

- architecture score (`0..100`)
- violations with `NXH` rule IDs and severity
- technical debt estimate (total days)
- debt breakdown by bounded context and top violations
- recommendations

#### Options

| Option | Description |
|---|---|
| `--fail-under <score>` | Exit 1 when score is below threshold |
| `--history` | Append this run to `node-hexa-history.jsonl` and show debt trend |
| `--baseline` | Write `node-hexa-baseline.json` |
| `--compare-baseline` | Compare against saved baseline |
| `--format ci` | GitHub Actions / GitLab annotation format |
| `--format sarif` | SARIF 2.1.0 for GitHub Code Scanning |
| `--output json` | Machine-readable JSON with full debt breakdown |
| `--output vscode` | VS Code diagnostic format |
| `--report html` | Generate `node-hexa-report.html` with charts |
| `--badge` | Generate `node-hexa-score.svg` badge |

### history

Purpose: display the technical debt trend from all recorded audit runs.

```bash
node-hexa history .
```

Example output:

```text
Technical Debt History

  Date                  Score   Debt (d)   Violations
  ─────────────────────────────────────────────────────
  2026-03-20 09:00       75        4.5     12
  2026-03-24 14:30       82        3.1      8
  2026-03-27 08:50       88        1.9      5

  Score trend : ↑ +6 pts vs previous run
  Debt trend  : -1.2d vs previous run
  Worst context  : orders
  Most improved  : iam
```

The history file (`node-hexa-history.jsonl`) is append-only JSONL — safe to commit and diff.

### check

Purpose: CI-friendly pass/fail check across all 4 rule engines.

```bash
node-hexa check .
node-hexa check . --watch   # re-run every 2s
```

Checks in order:
1. Architecture (dependency direction, DDD, layer isolation)
2. Clean code (constructor params, method count, file length)
3. Green code / eco-design (imports, tree-shaking, GC pressure)
4. Performance (DI overhead, bloated use cases, large adapters, cross-context fan-out)

Output:

- exits `0` — all checks passed (architecture, clean code, green code, performance)
- exits `1` — violations found
- exits `2` — configuration/runtime error

### doctor

Purpose: validate local readiness (Node, TypeScript, NestJS, config presence).

```bash
node-hexa doctor .
```

Output:

- environment checks with `ok`, `warn`, or `error`

### list

Purpose: list all bounded contexts and their components.

```bash
node-hexa list .
```

Output:

- per-context summary of entities, value objects, ports, use cases, domain events

### demo

Purpose: create a sample project with good and bad architecture patterns for demonstration.

```bash
node-hexa demo
```

Output:

- generated demo folder with intentional violations for live audit demonstration

## Audit Usage

### Default audit

```bash
node-hexa audit .
```

### Enforce minimum score

```bash
node-hexa audit . --fail-under 80
```

### Track debt over time

```bash
# Append each run to history and show trend
node-hexa audit . --history

# Show trend from history file only
node-hexa history .
```

### Machine-readable JSON

```bash
node-hexa audit . --output json
```

Example output (partial):

```json
{
  "score": 82,
  "maxScore": 100,
  "estimatedTechnicalDebtDays": 3.1,
  "debtBreakdown": {
    "total": 3.1,
    "byContext": {
      "orders": 2.3,
      "iam": 0.8
    },
    "byCategory": {
      "DEPENDENCY": 1.5,
      "DDD": 1.6
    },
    "topViolations": [
      { "ruleId": "NXH001", "code": "dependency-direction", "debtDays": 1.5, "message": "..." },
      { "ruleId": "NXH002", "code": "cross-context-coupling", "debtDays": 1.0, "message": "..." }
    ]
  },
  ...
}
```

### CI annotation format

```bash
node-hexa audit . --format ci
```

### HTML report

```bash
node-hexa audit . --report html
```

Generates `node-hexa-report.html` with:

- score card
- per-context debt bar chart
- top violations ranked by debt cost
- full findings table

## Performance Rules

Node-Hexa includes a dedicated performance rule engine targeting NestJS **startup cost** and **runtime overhead**:

| Rule | Trigger | Why |
|---|---|---|
| Heavy DI constructor | `constructorParamCount > 5` | Wide DI trees slow NestJS boot — each extra dep adds transitive resolution cost |
| Bloated use-case | use-case `methodCount > 5` | Use-cases must expose one `execute()` — extra methods load unused code paths eagerly |
| Large infra adapter | infra file `> 500 lines` | Large adapters hold big closures in the V8 heap, slow JIT |
| Cross-context fan-out | imports from `> 2` different contexts | Cascade module loading at startup |

Run perf checks:

```bash
node-hexa check .              # blocks on perf violations
node-hexa audit .              # shows performance score after main report
node-hexa audit . --output json   # includes perfScore + perfViolations
```

## Technical Debt Costs by Rule

Each rule has a calibrated debt cost in engineer-days:

| Rule | Code | Debt |
|---|---|---|
| Dependency direction | `dependency-direction` | 1.5d |
| Cross-context coupling | `cross-context-coupling` | 1.0d |
| Controller→Repository coupling | `controller-repository-coupling` | 1.0d |
| Forbidden dependency | `forbidden-dependency` | 1.0d |
| Layer boundary | `layer-boundary` | 0.8d |
| Missing use case | `missing-usecase` | 0.8d |
| Missing port | `missing-port` | 0.5d |
| Missing entity | `missing-entity` | 0.5d |
| Missing layer directory | `missing-layer-directory` | 0.3d |
| Naming conventions | `usecase-name`, `controller-name`, etc. | 0.1d |

## CI Integration Example

GitHub Actions example:

```yaml
name: architecture

on:
  pull_request:
  push:

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

## Architecture Rules

Node-Hexa rules are identified with `NXH` IDs (`NXH001`, `NXH002`, ...).

Each rule has:

- description
- why it matters
- how to fix
- severity

Full catalog: [ARCHITECTURE_RULES.md](ARCHITECTURE_RULES.md)

## Enterprise Usage

For governance and reporting workflows:

### Baseline

```bash
node-hexa audit . --baseline
node-hexa audit . --compare-baseline
```

### Debt history and trend

```bash
# Record every CI run
node-hexa audit . --history --fail-under 80

# View trend locally
node-hexa history .
```

### SARIF (GitHub Code Scanning)

```bash
node-hexa audit . --format sarif > results.sarif
```

### Quality gate enforcement

```bash
node-hexa audit . --fail-under 80
```

## Developer Workflow

```text
Developer writes code
  -> node-hexa audit .              (local feedback)
  -> node-hexa audit . --history    (track debt trend)
  -> CI enforces score threshold
  -> team reviews node-hexa history on main branch
```

## Typical Team Usage

Local development:

- run `node-hexa audit .` before commit

Pull request:

- CI runs `node-hexa audit . --fail-under 80 --format ci`

Main branch:

- track debt history and detect regressions

```bash
node-hexa audit . --history --compare-baseline
node-hexa history .
```

## Documentation Links

- [ARCHITECTURE_RULES.md](ARCHITECTURE_RULES.md)
- [example-audit-report.md](example-audit-report.md)
- [NODE_HEXA_ENTERPRISE_PITCH.md](NODE_HEXA_ENTERPRISE_PITCH.md)
- [CHANGELOG.md](CHANGELOG.md)

## Contributing

```bash
pnpm install
pnpm -r build
pnpm -r test
```

Pull requests should include:

- clear scope
- tests for behavior changes
- documentation updates for user-facing changes

## License

This repository uses a proprietary license.

See [LICENSE](LICENSE).

Node-Hexa helps teams keep architecture clean as projects scale.

---

Built by [Dawudesign](https://dawudesign.fr) — Studio d'architecture de marque & developer tooling.
