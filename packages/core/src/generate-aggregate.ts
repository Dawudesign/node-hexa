import fs from "node:fs";
import path from "node:path";
import { assertKebabCase, assertInsideProject } from "./guards";

export function generateAggregate(name: string, context: string) {
  assertKebabCase(name, "aggregate name");
  assertKebabCase(context, "context name");
  assertInsideProject();

  const base = path.join(process.cwd(), "src", "contexts", context);

  if (!fs.existsSync(base)) {
    throw new Error(
      `Context '${context}' does not exist at src/contexts/${context}. Run 'node-hexa generate context ${context}' first.`,
    );
  }

  const pascal = capitalize(name);
  const token = `${name.toUpperCase().replaceAll("-", "_")}_REPOSITORY_PORT`;

  const dirs = [
    "domain/entities",
    "domain/value-objects",
    "domain/ports",
    "application/use-cases",
    "infrastructure/persistence",
    "infrastructure/http",
  ];

  dirs.forEach((dir) => {
    fs.mkdirSync(path.join(base, dir), { recursive: true });
  });

  fs.writeFileSync(
    path.join(base, "domain/entities", `${name}.entity.ts`),
    `import { ${pascal}Id } from '../value-objects/${name}-id.vo';

export class ${pascal} {
  constructor(public readonly id: ${pascal}Id) {}
}
`,
  );

  fs.writeFileSync(
    path.join(base, "domain/value-objects", `${name}-id.vo.ts`),
    `export class ${pascal}Id {
  constructor(public readonly value: string) {}
}
`,
  );

  fs.writeFileSync(
    path.join(base, "domain/ports", `${name}.repository.port.ts`),
    `import { ${pascal} } from '../entities/${name}.entity';

export const ${token} = Symbol('${pascal}RepositoryPort');

export interface ${pascal}RepositoryPort {
  save(entity: ${pascal}): Promise<void>;
  findById(id: string): Promise<${pascal} | null>;
}
`,
  );

  fs.writeFileSync(
    path.join(base, "application/use-cases", `create-${name}.dto.ts`),
    `export type Create${pascal}Dto = {
  id: string;
};
`,
  );

  fs.writeFileSync(
    path.join(base, "application/use-cases", `create-${name}.usecase.ts`),
    `import { Inject, Injectable } from '@nestjs/common';
import { ${pascal} } from '../../domain/entities/${name}.entity';
import { ${pascal}Id } from '../../domain/value-objects/${name}-id.vo';
import {
  ${token},
  ${pascal}RepositoryPort,
} from '../../domain/ports/${name}.repository.port';
import { Create${pascal}Dto } from './create-${name}.dto';

@Injectable()
export class Create${pascal}UseCase {
  constructor(
    @Inject(${token})
    private readonly repository: ${pascal}RepositoryPort,
  ) {}

  async execute(dto: Create${pascal}Dto): Promise<${pascal}> {
    const entity = new ${pascal}(new ${pascal}Id(dto.id));
    await this.repository.save(entity);
    return entity;
  }
}
`,
  );

  fs.writeFileSync(
    path.join(base, "application/use-cases", `create-${name}.usecase.spec.ts`),
    `import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Create${pascal}UseCase } from './create-${name}.usecase';

const mockRepository = {
  save: vi.fn(),
  findById: vi.fn(),
};

describe('Create${pascal}UseCase', () => {
  let useCase: Create${pascal}UseCase;

  beforeEach(() => {
    useCase = new Create${pascal}UseCase(mockRepository as any);
  });

  it('should create and persist a ${pascal}', async () => {
    const result = await useCase.execute({ id: '123' });
    expect(result.id.value).toBe('123');
    expect(mockRepository.save).toHaveBeenCalledWith(result);
  });
});
`,
  );

  fs.writeFileSync(
    path.join(base, "infrastructure/persistence", `in-memory-${name}.repository.ts`),
    `import { Injectable } from '@nestjs/common';
import { ${pascal} } from '../../domain/entities/${name}.entity';
import { ${pascal}RepositoryPort } from '../../domain/ports/${name}.repository.port';

@Injectable()
export class InMemory${pascal}Repository implements ${pascal}RepositoryPort {
  private readonly store = new Map<string, ${pascal}>();

  async save(entity: ${pascal}): Promise<void> {
    this.store.set(entity.id.value, entity);
  }

  async findById(id: string): Promise<${pascal} | null> {
    return this.store.get(id) ?? null;
  }
}
`,
  );

  fs.writeFileSync(
    path.join(base, "infrastructure/http", `${name}.controller.ts`),
    `import { Body, Controller, Post } from '@nestjs/common';
import { Create${pascal}UseCase } from '../../application/use-cases/create-${name}.usecase';
import { Create${pascal}Dto } from '../../application/use-cases/create-${name}.dto';

@Controller('${name}')
export class ${pascal}Controller {
  constructor(private readonly create${pascal}: Create${pascal}UseCase) {}

  @Post()
  async create(@Body() dto: Create${pascal}Dto) {
    return this.create${pascal}.execute(dto);
  }
}
`,
  );

  fs.writeFileSync(
    path.join(base, `${name}.module.ts`),
    `import { Module } from '@nestjs/common';
import { ${token} } from './domain/ports/${name}.repository.port';
import { InMemory${pascal}Repository } from './infrastructure/persistence/in-memory-${name}.repository';
import { Create${pascal}UseCase } from './application/use-cases/create-${name}.usecase';
import { ${pascal}Controller } from './infrastructure/http/${name}.controller';

@Module({
  controllers: [${pascal}Controller],
  providers: [
    { provide: ${token}, useClass: InMemory${pascal}Repository },
    Create${pascal}UseCase,
  ],
})
export class ${pascal}Module {}
`,
  );

  console.log(`✓ Aggregate '${name}' generated in context '${context}' at src/contexts/${context}/`);
  console.log(`  → Import ${pascal}Module in your ${capitalize(context)}Module or AppModule.`);
}

function capitalize(str: string) {
  return str
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}
