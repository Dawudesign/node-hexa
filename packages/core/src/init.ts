import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function detectPackageManager(): "pnpm" | "npm" {
  try {
    execSync("pnpm --version", { stdio: "ignore" });
    return "pnpm";
  } catch {
    return "npm";
  }
}

export function generateProject(name: string) {
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
    "src/contexts/iam/domain/ports",
    "src/contexts/iam/application/use-cases",
    "src/contexts/iam/infrastructure/http",
    "src/contexts/iam/infrastructure/persistence",
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
import { IamModule } from './contexts/iam/iam.module';

@Module({
  imports: [IamModule],
})
export class AppModule {}
`
  );

  // ─── domain/entities/user.entity.ts ─────────────────────────────────────────
  fs.writeFileSync(
    path.join(base, "src/contexts/iam/domain/entities/user.entity.ts"),
`export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly name: string,
  ) {}
}
`
  );

  // ─── domain/ports/user.repository.port.ts ───────────────────────────────────
  fs.writeFileSync(
    path.join(base, "src/contexts/iam/domain/ports/user.repository.port.ts"),
`import { User } from '../entities/user.entity';

export const USER_REPOSITORY_PORT = Symbol('UserRepositoryPort');

export interface UserRepositoryPort {
  save(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
}
`
  );

  // ─── application/use-cases/create-user.usecase.ts ───────────────────────────
  fs.writeFileSync(
    path.join(base, "src/contexts/iam/application/use-cases/create-user.usecase.ts"),
`import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../domain/entities/user.entity';
import {
  USER_REPOSITORY_PORT,
  UserRepositoryPort,
} from '../../domain/ports/user.repository.port';
import { randomUUID } from 'node:crypto';

export interface CreateUserDto {
  email: string;
  name: string;
}

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(dto: CreateUserDto): Promise<User> {
    const user = new User(randomUUID(), dto.email, dto.name);
    await this.userRepository.save(user);
    return user;
  }
}
`
  );

  // ─── infrastructure/persistence/in-memory-user.repository.ts ────────────────
  fs.writeFileSync(
    path.join(
      base,
      "src/contexts/iam/infrastructure/persistence/in-memory-user.repository.ts"
    ),
`import { Injectable } from '@nestjs/common';
import { User } from '../../domain/entities/user.entity';
import { UserRepositoryPort } from '../../domain/ports/user.repository.port';

@Injectable()
export class InMemoryUserRepository implements UserRepositoryPort {
  private readonly store = new Map<string, User>();

  async save(user: User): Promise<void> {
    this.store.set(user.id, user);
  }

  async findById(id: string): Promise<User | null> {
    return this.store.get(id) ?? null;
  }
}
`
  );

  // ─── infrastructure/http/user.controller.ts ─────────────────────────────────
  fs.writeFileSync(
    path.join(base, "src/contexts/iam/infrastructure/http/user.controller.ts"),
`import { Body, Controller, Post } from '@nestjs/common';
import { CreateUserUseCase, CreateUserDto } from '../../application/use-cases/create-user.usecase';

@Controller('users')
export class UserController {
  constructor(private readonly createUser: CreateUserUseCase) {}

  @Post()
  async create(@Body() dto: CreateUserDto) {
    return this.createUser.execute(dto);
  }
}
`
  );

  // ─── iam.module.ts ───────────────────────────────────────────────────────────
  fs.writeFileSync(
    path.join(base, "src/contexts/iam/iam.module.ts"),
`import { Module } from '@nestjs/common';
import { USER_REPOSITORY_PORT } from './domain/ports/user.repository.port';
import { InMemoryUserRepository } from './infrastructure/persistence/in-memory-user.repository';
import { CreateUserUseCase } from './application/use-cases/create-user.usecase';
import { UserController } from './infrastructure/http/user.controller';

@Module({
  controllers: [UserController],
  providers: [
    {
      provide: USER_REPOSITORY_PORT,
      useClass: InMemoryUserRepository,
    },
    CreateUserUseCase,
  ],
})
export class IamModule {}
`
  );

  // ─── shared/.gitkeep ────────────────────────────────────────────────────────
  fs.writeFileSync(path.join(base, "src/shared/.gitkeep"), "");

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
  console.log(`  cd ${name} && pnpm start:dev`);
}