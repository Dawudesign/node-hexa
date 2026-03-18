# Node-Hexa Architecture Rules Catalog

This catalog documents the current Node-Hexa rule set (`NXH001` to `NXH013`).

## NXH001

- Description: Domain depends on infrastructure (dependency direction violation).
- Why it matters: Breaks Hexagonal DDD boundaries and increases coupling.
- How to fix: Introduce domain ports and invert dependency through interfaces/adapters.
- Severity: ERROR

## NXH002

- Description: Cross-context coupling detected.
- Why it matters: Bounded contexts lose autonomy and changes ripple across domains.
- How to fix: Use anti-corruption layers, integration contracts, or application services between contexts.
- Severity: WARNING

## NXH003

- Description: Layer boundary violation (wrong layer placement/framework leakage).
- Why it matters: Weakens maintainability and testability of domain/application layers.
- How to fix: Move framework or persistence concerns to infrastructure adapters.
- Severity: ERROR or WARNING (based on violation severity)

## NXH004

- Description: Controller directly depends on repository implementation.
- Why it matters: Skips application/use-case orchestration and couples HTTP layer to persistence.
- How to fix: Route controller actions through use cases; inject repository ports in application layer.
- Severity: ERROR

## NXH005

- Description: Forbidden dependency pattern detected (configured policy).
- Why it matters: Violates architecture constraints defined by the team.
- How to fix: Refactor dependency to comply with configured allowed direction/relationships.
- Severity: ERROR

## NXH006

- Description: Use case naming convention violation.
- Why it matters: Reduces discoverability and consistency in application layer.
- How to fix: Rename to `<Action><Entity>UseCase`.
- Severity: INFO

## NXH007

- Description: Controller naming convention violation.
- Why it matters: Makes adapter-in components harder to identify.
- How to fix: Rename to `<Resource>Controller`.
- Severity: INFO

## NXH008

- Description: Repository naming convention violation.
- Why it matters: Persistence adapters become ambiguous and inconsistent.
- How to fix: Rename to `<Entity>Repository`.
- Severity: INFO

## NXH009

- Description: Port naming convention violation.
- Why it matters: Domain contracts become less explicit.
- How to fix: Rename to `<Capability>Port`.
- Severity: INFO

## NXH010

- Description: Missing required layer directory (`domain`, `application`, or `infrastructure`).
- Why it matters: Signals incomplete Hexagonal structure in a bounded context.
- How to fix: Create missing layer folders and move files to proper locations.
- Severity: ERROR

## NXH011

- Description: No entity detected in bounded context.
- Why it matters: Indicates weak domain modeling and possible anemic architecture.
- How to fix: Define aggregate roots/entities in domain layer.
- Severity: WARNING

## NXH012

- Description: No domain port detected in bounded context.
- Why it matters: Prevents proper dependency inversion between application and infrastructure.
- How to fix: Create domain port interfaces and bind adapters through DI.
- Severity: ERROR

## NXH013

- Description: Controllers exist but no use case detected.
- Why it matters: Business orchestration leaks into controllers.
- How to fix: Add application use cases and route controller logic through them.
- Severity: ERROR
