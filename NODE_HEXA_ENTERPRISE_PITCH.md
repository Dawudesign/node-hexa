# Node-Hexa Enterprise Pitch

## Problem

NestJS teams often start with clean architecture intent, then drift over time:

- domain logic leaks into infrastructure
- controllers bypass use cases
- bounded contexts become tightly coupled
- architecture reviews become inconsistent and subjective

Result: architecture debt grows silently and slows delivery.

## Solution

Node-Hexa provides **automated architecture governance** for NestJS Hexagonal DDD projects.

It continuously evaluates architecture conformance, produces a clear score, flags violations with rule IDs, and integrates directly with CI.

## Business Value

- **Reduce technical debt**
  - Detect dependency-direction violations and missing DDD building blocks early.
- **Standardize architecture**
  - Enforce one architecture contract across teams and repositories.
- **Improve onboarding**
  - New engineers understand expected structure through explicit rules and reports.
- **Enforce DDD in practice**
  - Validate ports, use cases, and context boundaries automatically.

## Enterprise Use Cases

### 1. CI Enforcement

Block pull requests when architecture score drops below threshold.

### 2. Architecture Reviews

Use Node-Hexa reports as objective evidence during design and review meetings.

### 3. Migration Projects

Measure progress from legacy NestJS structures toward Hexagonal DDD target architecture.

## Why Teams Adopt It

- Fast feedback for developers
- Consistent policy for tech leads
- Quantifiable signals for engineering managers

Node-Hexa makes architecture quality visible, enforceable, and repeatable.
