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
  const configPath = path.join(process.cwd(), "node-hexa.config.json");
  const contextsPath = path.join(process.cwd(), "src", "contexts");

  if (!fs.existsSync(pkgPath)) {
    throw new Error(
      "No package.json found. Run this command from the root of your project.",
    );
  }

  if (!fs.existsSync(configPath) && !fs.existsSync(contextsPath)) {
    throw new Error(
      "No node-hexa.config.json or src/contexts/ found.\n" +
      "Run this command from the root of a node-hexa project, or run 'node-hexa init <name>' first.",
    );
  }
}
