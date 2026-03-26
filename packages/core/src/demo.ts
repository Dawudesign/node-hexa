import fs from "node:fs";
import path from "node:path";

export function generateDemoProject(dirName = "node-hexa-demo"): string {
  const dest = path.join(process.cwd(), dirName);

  if (fs.existsSync(dest)) {
    throw new Error(`Demo directory "${dirName}" already exists. Remove it first or choose a different folder.`);
  }

  fs.mkdirSync(path.join(dest, "src", "contexts", "good", "domain", "entities"), { recursive: true });
  fs.mkdirSync(path.join(dest, "src", "contexts", "good", "domain", "ports"), { recursive: true });
  fs.mkdirSync(path.join(dest, "src", "contexts", "good", "application", "use-cases"), { recursive: true });
  fs.mkdirSync(path.join(dest, "src", "contexts", "good", "infrastructure", "persistence"), { recursive: true });

  fs.mkdirSync(path.join(dest, "src", "contexts", "bad", "domain", "entities"), { recursive: true });
  fs.mkdirSync(path.join(dest, "src", "contexts", "bad", "infrastructure", "persistence"), { recursive: true });

  fs.writeFileSync(
    path.join(dest, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: true,
        },
        include: ["src/**/*.ts"],
      },
      null,
      2,
    ),
  );

  fs.writeFileSync(
    path.join(dest, "node-hexa.config.ts"),
`export default {
  architecture: {
    hexagonal: true,
    ddd: true,
  },
  rules: {
    enforcePorts: true,
    enforceUseCases: true,
    forbiddenDependencies: ["infra -> domain"],
  },
  qualityGate: {
    minScore: 80,
  },
};
`,
  );

  fs.writeFileSync(
    path.join(dest, "src", "contexts", "good", "domain", "entities", "customer.entity.ts"),
`export class CustomerEntity {
  constructor(public readonly id: string, public readonly email: string) {}
}
`,
  );

  fs.writeFileSync(
    path.join(dest, "src", "contexts", "good", "domain", "ports", "customer.repository.port.ts"),
`import { CustomerEntity } from '../entities/customer.entity';

export const CUSTOMER_REPOSITORY_PORT = Symbol('CustomerRepositoryPort');

export interface CustomerRepositoryPort {
  save(entity: CustomerEntity): Promise<CustomerEntity>;
}
`,
  );

  fs.writeFileSync(
    path.join(dest, "src", "contexts", "good", "application", "use-cases", "create-customer.usecase.ts"),
`import { Inject, Injectable } from '@nestjs/common';
import { CustomerEntity } from '../../domain/entities/customer.entity';
import { CUSTOMER_REPOSITORY_PORT, CustomerRepositoryPort } from '../../domain/ports/customer.repository.port';

@Injectable()
export class CreateCustomerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY_PORT)
    private readonly repository: CustomerRepositoryPort,
  ) {}

  async execute(email: string): Promise<CustomerEntity> {
    const entity = new CustomerEntity('demo-id', email);
    return this.repository.save(entity);
  }
}
`,
  );

  fs.writeFileSync(
    path.join(dest, "src", "contexts", "good", "infrastructure", "persistence", "in-memory-customer.repository.ts"),
`import { CustomerEntity } from '../../domain/entities/customer.entity';
import { CustomerRepositoryPort } from '../../domain/ports/customer.repository.port';

export class InMemoryCustomerRepository implements CustomerRepositoryPort {
  async save(entity: CustomerEntity): Promise<CustomerEntity> {
    return entity;
  }
}
`,
  );

  fs.writeFileSync(
    path.join(dest, "src", "contexts", "bad", "infrastructure", "persistence", "legacy.repository.ts"),
`export class LegacyRepository {
  findAll() {
    return [];
  }
}
`,
  );

  fs.writeFileSync(
    path.join(dest, "src", "contexts", "bad", "domain", "entities", "bad.entity.ts"),
`import { LegacyRepository } from '../../infrastructure/persistence/legacy.repository';

export class BadEntity {
  constructor(private readonly repository: LegacyRepository) {}
}
`,
  );

  fs.writeFileSync(
    path.join(dest, "AUDIT_RESULTS.md"),
`# Demo Audit Results

This demo includes:

- good: follows Hexagonal DDD style
- bad: intentionally violates dependency direction

Run:

- npx @dawudesign/node-hexa-cli audit .
- npx @dawudesign/node-hexa-cli audit . --format ci
- npx @dawudesign/node-hexa-cli audit . --output json

Expected outcome:

- at least one DEPENDENCY violation (domain imports infra)
- architecture score below perfect
`,
  );

  return dest;
}
