# @dawudesign/node-hexa-cli

> Scaffold and enforce **NestJS Hexagonal DDD** architecture from the command line.

- **Scaffold** — generate a full NestJS project or bounded context in one command
- **Enforce** — statically analyze your TypeScript source and report architecture violations
- **Document** — export a Mermaid diagram and architecture report

---

## Requirements

- Node.js ≥ 20
- npm or pnpm

---

## Installation

```bash
npm install -g @dawudesign/node-hexa-cli
```

---

## Commands

### `init`

Create a new NestJS project with the full Hexagonal DDD structure.

```bash
node-hexa init <name>
```

```bash
node-hexa init my-app
cd my-app
pnpm start:dev
```

Generated structure:

```text
my-app/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── contexts/       ← add your bounded contexts here
│   └── shared/
└── node-hexa.config.json
```

Then add your first bounded context:

```bash
cd my-app
node-hexa generate context orders
```

---

### `generate`

Generate scaffolding inside an existing project.

```bash
node-hexa generate context <name>
node-hexa generate usecase <name> <context>
node-hexa generate aggregate <name> <context>
```

```bash
# New bounded context
node-hexa generate context orders

# Use case inside a context
node-hexa generate usecase delete-user iam

# Full DDD aggregate (entity, port, use case, controller, repository)
node-hexa generate aggregate product catalog
```

---

### `check`

Check architecture violations. Exits `0` if clean, `1` if violations found. Designed for CI.

```bash
node-hexa check <path>
node-hexa check <path> --watch
```

```bash
# One-shot (CI)
node-hexa check .

# Watch mode
node-hexa check . --watch
```

Output:

```text
✓ Architecture check passed
```

or:

```text
✗ Architecture violations detected

  [CRITICAL] Domain must not depend on infrastructure → UserEntity
  [HIGH] Application must not depend on infrastructure → CreateUserUseCase
```

---

### `analyze`

Full analysis: layers, violations, bounded contexts, Mermaid diagram, and score.

```bash
node-hexa analyze <path>
```

---

### `list`

List all bounded contexts and their components.

```bash
node-hexa list <path>
```

Output:

```text
Bounded Contexts (2)

  IAM
    Entities      : user.entity
    Ports         : user.repository.port
    Use Cases     : create-user.usecase

  CATALOG
    Entities      : product.entity
    Ports         : product.repository.port
    Use Cases     : create-product.usecase
```

---

### `docs`

Generate an `architecture.md` at the project root with the Mermaid diagram and violations.

```bash
node-hexa docs <path>
```

---

### `graph`

Generate an `architecture.svg` dependency graph (requires `@mermaid-js/mermaid-cli`).

```bash
npm install -g @mermaid-js/mermaid-cli
node-hexa graph <path>
```

---

## Configuration

`node-hexa.config.json` at the project root (created by `init`, all keys optional):

```json
{
  "architecture": "hexagonal-ddd",
  "strict": true,
  "contextsDir": "src/contexts"
}
```

| Key | Type | Default | Description |
| --- | ---- | ------- | ----------- |
| `architecture` | `string` | `"hexagonal-ddd"` | Architecture type |
| `strict` | `boolean` | `true` | `false` silences `MEDIUM` violations |
| `contextsDir` | `string` | `"src/contexts"` | Path to bounded contexts directory |

---

## Violation rules

| Violation | Severity |
| --------- | -------- |
| Domain imports from infrastructure or adapter | `CRITICAL` |
| Domain imports from application | `CRITICAL` |
| Domain imports a framework (`@nestjs/*`, `prisma`…) | `CRITICAL` |
| Application imports from infrastructure or adapter | `HIGH` |

---

## License

MIT

