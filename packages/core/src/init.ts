import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type ProjectTemplate = "api" | "microservice" | "event-driven";

export type GenerateProjectOptions = {
  template?: ProjectTemplate;
  withCi?: boolean;
};

function detectPackageManager(): "pnpm" | "npm" {
  try {
    execSync("pnpm --version", { stdio: "ignore" });
    return "pnpm";
  } catch {
    return "npm";
  }
}

function toPascalCase(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function templateContextName(template: ProjectTemplate): string {
  if (template === "microservice") return "billing";
  if (template === "event-driven") return "orders";
  return "iam";
}

function writeTemplateScaffold(base: string, template: ProjectTemplate): void {
  const context = templateContextName(template);
  const pascal = toPascalCase(context);
  const contextRoot = path.join(base, "src", "contexts", context);

  const dirs = [
    path.join(contextRoot, "domain", "entities"),
    path.join(contextRoot, "domain", "ports"),
    path.join(contextRoot, "application", "use-cases"),
    path.join(contextRoot, "infrastructure", "http"),
    path.join(contextRoot, "infrastructure", "persistence"),
    path.join(base, "test"),
  ];

  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(contextRoot, "domain", "entities", `${context}.entity.ts`),
`export class ${pascal}Entity {
  constructor(
    public readonly id: string,
    public readonly name: string,
  ) {}
}
`,
  );

  fs.writeFileSync(
    path.join(contextRoot, "domain", "ports", `${context}.repository.port.ts`),
`import { ${pascal}Entity } from '../entities/${context}.entity';

export const ${context.toUpperCase()}_REPOSITORY_PORT = Symbol('${pascal}RepositoryPort');

export interface ${pascal}RepositoryPort {
  save(entity: ${pascal}Entity): Promise<${pascal}Entity>;
}
`,
  );

  fs.writeFileSync(
    path.join(contextRoot, "application", "use-cases", `create-${context}.usecase.ts`),
`import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ${pascal}Entity } from '../../domain/entities/${context}.entity';
import { ${context.toUpperCase()}_REPOSITORY_PORT, ${pascal}RepositoryPort } from '../../domain/ports/${context}.repository.port';

@Injectable()
export class Create${pascal}UseCase {
  constructor(
    @Inject(${context.toUpperCase()}_REPOSITORY_PORT)
    private readonly repository: ${pascal}RepositoryPort,
  ) {}

  async execute(name: string): Promise<${pascal}Entity> {
    const entity = new ${pascal}Entity(randomUUID(), name);
    return this.repository.save(entity);
  }
}
`,
  );

  fs.writeFileSync(
    path.join(contextRoot, "infrastructure", "persistence", `in-memory-${context}.repository.ts`),
`import { Injectable } from '@nestjs/common';
import { ${pascal}Entity } from '../../domain/entities/${context}.entity';
import { ${pascal}RepositoryPort } from '../../domain/ports/${context}.repository.port';

@Injectable()
export class InMemory${pascal}Repository implements ${pascal}RepositoryPort {
  private readonly items: ${pascal}Entity[] = [];

  async save(entity: ${pascal}Entity): Promise<${pascal}Entity> {
    this.items.push(entity);
    return entity;
  }
}
`,
  );

  fs.writeFileSync(
    path.join(contextRoot, "infrastructure", "http", `${context}.controller.ts`),
`import { Body, Controller, Post } from '@nestjs/common';
import { Create${pascal}UseCase } from '../../application/use-cases/create-${context}.usecase';

@Controller('${context}')
export class ${pascal}Controller {
  constructor(private readonly createUseCase: Create${pascal}UseCase) {}

  @Post()
  async create(@Body() body: { name: string }) {
    return this.createUseCase.execute(body.name);
  }
}
`,
  );

  fs.writeFileSync(
    path.join(contextRoot, `${context}.module.ts`),
`import { Module } from '@nestjs/common';
import { ${pascal}Controller } from './infrastructure/http/${context}.controller';
import { Create${pascal}UseCase } from './application/use-cases/create-${context}.usecase';
import { ${context.toUpperCase()}_REPOSITORY_PORT } from './domain/ports/${context}.repository.port';
import { InMemory${pascal}Repository } from './infrastructure/persistence/in-memory-${context}.repository';

@Module({
  controllers: [${pascal}Controller],
  providers: [
    Create${pascal}UseCase,
    { provide: ${context.toUpperCase()}_REPOSITORY_PORT, useClass: InMemory${pascal}Repository },
  ],
})
export class ${pascal}Module {}
`,
  );

  fs.writeFileSync(
    path.join(base, "test", `${context}.template.spec.ts`),
`import { describe, expect, it } from 'vitest';

describe('${context} template', () => {
  it('provides a bootstrapped hexagonal sample', () => {
    expect(true).toBe(true);
  });
});
`,
  );

  fs.writeFileSync(
    path.join(base, "src", "app.module.ts"),
`import { Module } from '@nestjs/common';
import { ${pascal}Module } from './contexts/${context}/${context}.module';

@Module({
  imports: [${pascal}Module],
})
export class AppModule {}
`,
  );
}

function writeCiFiles(base: string): void {
  fs.mkdirSync(path.join(base, ".github", "workflows"), { recursive: true });

  fs.writeFileSync(
    path.join(base, ".github", "workflows", "node-hexa.yml"),
`name: node-hexa

on:
  push:
  pull_request:

jobs:
  node-hexa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r build
      - run: npx @dawudesign/node-hexa-cli audit . --fail-under 80
`,
  );

  fs.writeFileSync(
    path.join(base, ".gitlab-ci.yml"),
`stages:
  - install
  - build
  - audit

install:
  image: node:20
  stage: install
  script:
    - corepack enable
    - pnpm install --frozen-lockfile

build:
  image: node:20
  stage: build
  script:
    - corepack enable
    - pnpm -r build

audit:
  image: node:20
  stage: audit
  script:
    - corepack enable
    - npx @dawudesign/node-hexa-cli audit . --fail-under 80
`,
  );
}

function writeAdoptionDocs(base: string, template: ProjectTemplate, withCi: boolean): void {
  fs.writeFileSync(
    path.join(base, "GETTING_STARTED.md"),
`# Getting Started

Template: ${template}

1. Install dependencies
   - pnpm install
2. Run the app
   - pnpm start:dev
3. Run architecture governance
   - npx @dawudesign/node-hexa-cli audit . --fail-under 80
`,
  );

  fs.writeFileSync(
    path.join(base, "CI_INTEGRATION.md"),
`# CI Integration

CI templates generated: ${withCi ? "yes" : "no"}

Recommended pipeline steps:

1. pnpm install --frozen-lockfile
2. pnpm -r build
3. npx @dawudesign/node-hexa-cli audit . --fail-under 80
`,
  );

  fs.writeFileSync(
    path.join(base, "ENTERPRISE_USAGE.md"),
`# Enterprise Usage

Baseline workflow:

1. npx @dawudesign/node-hexa-cli audit . --baseline
2. npx @dawudesign/node-hexa-cli audit . --compare-baseline

Machine outputs:

- --output json
- --format ci
- --format sarif
`,
  );
}

export function generateProject(name: string, options: GenerateProjectOptions = {}) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    throw new Error(
      `Invalid project name "${name}". Use lowercase letters, digits, and hyphens only (e.g. my-app).`,
    );
  }

  const dest = path.join(process.cwd(), name);
  if (fs.existsSync(dest)) {
    throw new Error(
      `Directory "${name}" already exists. Remove it first or choose a different name.`,
    );
  }

  const template = options.template ?? "api";
  const withCi = options.withCi ?? false;
  const pm = detectPackageManager();

  console.log("Creating NestJS project...");

  try {
    execSync(
      `npx @nestjs/cli@latest new ${name} --package-manager ${pm} --skip-git`,
      { stdio: "inherit" }
    );
  } catch {
    throw new Error(
      `Failed to scaffold the NestJS project "${name}".\n` +
      `  Make sure you have a working internet connection and npm access.\n` +
      `  Try manually: npx @nestjs/cli@latest new ${name}`,
    );
  }

  const base = path.join(process.cwd(), name);

  console.log("Applying Hexagonal DDD structure...");

  const src = path.join(base, "src");
  fs.rmSync(src, { recursive: true, force: true });

  const dirs = [
    "src/contexts",
    "src/shared",
  ];

  dirs.forEach((dir) => {
    fs.mkdirSync(path.join(base, dir), { recursive: true });
  });

  // ─── main.ts ────────────────────────────────────────────────────────────────
  fs.writeFileSync(
    path.join(base, "src/main.ts"),
`import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
`
  );

  // ─── app.module.ts ──────────────────────────────────────────────────────────
  fs.writeFileSync(
    path.join(base, "src/app.module.ts"),
`import { Module } from '@nestjs/common';

@Module({
  imports: [],
})
export class AppModule {}
`
  );

  // ─── src/contexts/.gitkeep ──────────────────────────────────────────────────
  fs.writeFileSync(path.join(base, "src/contexts/.gitkeep"), "");

  // ─── shared/.gitkeep ────────────────────────────────────────────────────────
  fs.writeFileSync(path.join(base, "src/shared/.gitkeep"), "");

  writeTemplateScaffold(base, template);

  if (withCi) {
    writeCiFiles(base);
  }

  writeAdoptionDocs(base, template, withCi);

  // ─── node-hexa.config.json ──────────────────────────────────────────────────
  fs.writeFileSync(
    path.join(base, "node-hexa.config.json"),
    JSON.stringify(
      {
        architecture: "hexagonal-ddd",
        strict: true,
        contextsDir: "src/contexts",
      },
      null,
      2
    )
  );

  console.log(`\n✓ Hexagonal DDD NestJS project ready at ./${name}`);
  console.log(`  Template: ${template}`);
  if (withCi) {
    console.log("  CI templates generated: .github/workflows/node-hexa.yml and .gitlab-ci.yml");
  }
  console.log(`  cd ${name} && pnpm start:dev`);
}