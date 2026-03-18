# Node-Hexa Positioning

## Where Node-Hexa Fits

Node-Hexa is an **architecture governance tool for NestJS Hexagonal DDD**.

It sits between code-level quality tools and broad enterprise governance platforms, focusing specifically on architecture integrity.

## Comparison

## ESLint

- Primary focus: syntax, style, code smells, and generic best practices.
- Strength: fast per-file code quality feedback.
- Gap: limited architecture-level context across DDD layers and bounded contexts.

Node-Hexa complement:

- Adds architecture scoring, DDD boundary checks, and dependency-direction governance.

## SonarQube

- Primary focus: code quality, security hotspots, maintainability, governance dashboards.
- Strength: enterprise-wide code governance and quality gates.
- Gap: architecture intent for NestJS Hexagonal DDD is not its core specialization.

Node-Hexa complement:

- Provides domain-specific architecture rules (`NXHxxx`) tailored to Hexagonal DDD teams.
- Produces CI-friendly outputs (including JSON/CI/SARIF) to plug into existing governance pipelines.

## ArchUnit

- Primary focus: architecture tests in JVM ecosystems via code-defined rules.
- Strength: explicit architecture assertions in Java/Kotlin projects.
- Gap: not targeted to NestJS/TypeScript development flows.

Node-Hexa equivalent role for NestJS:

- Delivers architecture-policy enforcement for Node/NestJS teams with minimal setup.

## Positioning Statement

Node-Hexa is to **NestJS architecture governance** what ESLint is to syntax quality:

- opinionated,
- automatable,
- CI-enforceable,
- and understandable by both developers and engineering leadership.

Use Node-Hexa alongside ESLint and SonarQube, not instead of them.
