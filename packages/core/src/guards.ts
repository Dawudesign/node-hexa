import fs from "node:fs";
import path from "node:path";

export const NAME_RE = /^[a-z][a-z0-9-]*$/;

export function assertKebabCase(value: string, label: string): void {
  if (!NAME_RE.test(value)) {
    throw new Error(
      `Invalid ${label} "${value}". Use lowercase letters, digits, and hyphens (e.g. my-context).`,
    );
  }
}

export function assertInsideProject(): void {
  const pkgPath = path.join(process.cwd(), "package.json");

  if (!fs.existsSync(pkgPath)) {
    throw new Error(
      "No package.json found. Run this command from the root of your NestJS project.",
    );
  }

  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
  } catch {
    throw new Error(
      "Could not parse package.json. Make sure it contains valid JSON.",
    );
  }

  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (!allDeps["@nestjs/core"]) {
    throw new Error(
      "@nestjs/core not found in dependencies. node-hexa only works with NestJS projects.",
    );
  }
}
