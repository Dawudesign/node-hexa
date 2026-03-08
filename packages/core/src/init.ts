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
  imports: [
    // Import your bounded context modules here
    // e.g. import { OrdersModule } from './contexts/orders/orders.module';
  ],
})
export class AppModule {}
`
  );

  // ─── src/contexts/.gitkeep ──────────────────────────────────────────────────
  fs.writeFileSync(path.join(base, "src/contexts/.gitkeep"), "");

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