# Node Hexa

## TL;DR

Install:

```bash
npm install -g @dawudesign/node-hexa-cli
```

Run:

```bash
node-hexa init my-app
node-hexa audit .
```

Node-Hexa helps teams enforce architecture rules automatically as projects grow.

Architecture governance CLI for NestJS (Hexagonal Architecture + DDD + Clean Architecture)

Node-Hexa automatically enforces Hexagonal Architecture and DDD in NestJS projects to prevent architecture drift.

## Command Cheat Sheet

| Command | Purpose |
|---|---|
| `audit` | Analyze architecture quality and report score/violations |
| `init` | Create a NestJS project scaffold with Node-Hexa structure |
| `check` | Validate architecture, clean code, and green code rules for CI |

## Example Architecture Enforced

```text
src/
  contexts/
    orders/
      domain/
      application/
      infrastructure/
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

- you use NestJS
- you use DDD / Hexagonal Architecture
- you want enforceable architecture rules
- you want CI architecture checks and score thresholds

## When Not to Use It

Node-Hexa is usually not useful for:

- very small scripts
- throwaway prototypes
- projects that are not organized around DDD/architecture boundaries

## What Node-Hexa Does

- Generate clean architecture project scaffolding
- Audit architecture quality with a score and rule violations
- Detect boundary and dependency violations
- Enforce architecture standards in CI
- Track architecture evolution through baseline comparison

## Quick Example

```bash
node-hexa audit .
```

Example output:

```text
Node Hexa Architecture Report

Architecture score: 60/100
Estimated technical debt: 1.5 days

DDD compliance: ERROR
Hexagonal boundaries: ERROR
Dependency violations: ERROR

Detected problems:
- [NXH012][ERROR][DDD] Context 'bad' has no domain port
- [NXH010][ERROR][STRUCTURE] Context 'bad' is missing 'application' directory
- [NXH001][ERROR][DEPENDENCY] Domain must not depend on infrastructure

Recommendations:
- Create domain ports to invert dependencies between application and infrastructure layers.
- Create the standard hexagonal folders: domain, application, and infrastructure.
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

Output:

- project created
- architecture config generated
- optional CI templates generated (`.github/workflows/node-hexa.yml`, `.gitlab-ci.yml`)

### generate

Purpose: generate architecture elements inside an existing project.

```bash
node-hexa generate context orders
node-hexa generate usecase create-order orders
node-hexa generate aggregate product catalog
```

Output:

- generated files for context/use case/aggregate using expected folder conventions

### audit

Purpose: evaluate architecture quality and produce governance outputs.

```bash
node-hexa audit .
```

Output:

- architecture score
- violations with `NXH` rule IDs
- recommendations
- technical debt estimate

### check

Purpose: CI-friendly pass/fail check for architecture, clean code, and green code rules.

```bash
node-hexa check .
```

Output:

- exits `0` when clean
- exits `1` on violations
- exits `2` on configuration/runtime errors

### doctor

Purpose: validate local readiness (Node, TypeScript, NestJS, config presence).

```bash
node-hexa doctor .
```

Output:

- environment checks with `ok`, `warn`, or `error`

### demo

Purpose: create a sample project with good and bad architecture patterns for demonstration.

```bash
node-hexa demo
```

Output:

- generated demo folder with intentional violations for live audit demonstration

## Audit Usage

Node-Hexa audit is centered on four outputs:

- score (`0..100`)
- violations (`NXH` rules)
- technical debt estimate (days)
- quality gate status

### Default audit

```bash
node-hexa audit .
```

### Enforce minimum score

```bash
node-hexa audit . --fail-under 80
```

### Machine-readable JSON

```bash
node-hexa audit . --output json
```

### CI annotation format

```bash
node-hexa audit . --format ci
```

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
      - run: npx @dawudesign/node-hexa-cli audit . --fail-under 80 --format ci
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

### SARIF

```bash
node-hexa audit . --format sarif
```

### JSON

```bash
node-hexa audit . --output json
```

### Quality gate enforcement

```bash
node-hexa audit . --fail-under 80
```

## Developer Workflow Diagram

Developer workflow diagram:

```text
Developer writes code
  -> runs node-hexa audit
  -> fixes violations
  -> CI enforces score
```

## Typical Team Usage

Local development:

- run `node-hexa audit .` before commit

Pull request:

- CI runs `node-hexa audit . --fail-under 80 --format ci`

Main branch:

- compare against baseline for architecture evolution tracking

```bash
node-hexa audit . --compare-baseline --output json
```

## Example Workflow

Typical team workflow:

1. Local development: run audit before commit.

```bash
node-hexa audit .
```

2. Pull request: enforce threshold and annotate CI logs.

```bash
node-hexa audit . --fail-under 80 --format ci
```

3. Main branch: keep baseline and monitor architecture evolution.

```bash
node-hexa audit . --compare-baseline --output json
```

## Documentation Links

- [ARCHITECTURE_RULES.md](ARCHITECTURE_RULES.md)
- [example-audit-report.md](example-audit-report.md)
- [NODE_HEXA_ENTERPRISE_PITCH.md](NODE_HEXA_ENTERPRISE_PITCH.md)

## Roadmap

No public roadmap document is currently maintained in this repository.

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
