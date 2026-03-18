import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

export type DoctorCheckStatus = "ok" | "warn" | "error";

export type DoctorCheck = {
  name: string;
  status: DoctorCheckStatus;
  message: string;
};

const requireForResolve = createRequire(path.join(process.cwd(), "node-hexa-doctor-resolver.cjs"));

function parseMajor(version: string): number {
  const clean = version.startsWith("v") ? version.slice(1) : version;
  const major = Number(clean.split(".")[0]);
  return Number.isFinite(major) ? major : 0;
}

function resolvePackageVersion(packageName: string, cwd: string): string | null {
  try {
    const pkgPath = requireForResolve.resolve(`${packageName}/package.json`, {
      paths: [cwd],
    });
    const content = fs.readFileSync(pkgPath, "utf8");
    const parsed = JSON.parse(content) as { version?: string };
    return parsed.version ?? null;
  } catch {
    return null;
  }
}

function checkNodeVersion(): DoctorCheck {
  const version = process.version;
  const major = parseMajor(version);

  if (major >= 20) {
    return {
      name: "Node.js",
      status: "ok",
      message: `Node ${version}`,
    };
  }

  return {
    name: "Node.js",
    status: "error",
    message: `Node ${version} detected. Node 20+ is recommended.`,
  };
}

function checkConfigFile(projectPath: string): DoctorCheck {
  const jsonConfig = path.join(projectPath, "node-hexa.config.json");
  const tsConfig = path.join(projectPath, "node-hexa.config.ts");

  if (fs.existsSync(jsonConfig) || fs.existsSync(tsConfig)) {
    return {
      name: "node-hexa config",
      status: "ok",
      message: "Found node-hexa.config.json or node-hexa.config.ts",
    };
  }

  return {
    name: "node-hexa config",
    status: "warn",
    message: "No node-hexa.config.json/ts found. Defaults will be used.",
  };
}

function checkTypeScript(projectPath: string): DoctorCheck {
  const version = resolvePackageVersion("typescript", projectPath);

  if (version) {
    return {
      name: "TypeScript",
      status: "ok",
      message: `typescript@${version}`,
    };
  }

  return {
    name: "TypeScript",
    status: "warn",
    message: "TypeScript is not installed in this workspace.",
  };
}

function checkNest(projectPath: string): DoctorCheck {
  const version = resolvePackageVersion("@nestjs/common", projectPath);

  if (version) {
    return {
      name: "NestJS",
      status: "ok",
      message: `@nestjs/common@${version}`,
    };
  }

  return {
    name: "NestJS",
    status: "warn",
    message: "NestJS was not detected in dependencies.",
  };
}

export function runDoctor(projectPath: string): DoctorCheck[] {
  const checks: DoctorCheck[] = [];

  checks.push(checkNodeVersion());
  checks.push(checkTypeScript(projectPath));
  checks.push(checkNest(projectPath));
  checks.push(checkConfigFile(projectPath));

  return checks;
}

function iconFor(status: DoctorCheckStatus): string {
  if (status === "ok") return "✓";
  if (status === "warn") return "⚠";
  return "✗";
}

export function printDoctorReport(checks: DoctorCheck[]): void {
  console.log("\nNode Hexa Doctor\n");

  for (const check of checks) {
    console.log(`  ${iconFor(check.status)} ${check.name}: ${check.message}`);
  }

  const hasError = checks.some((check) => check.status === "error");
  const hasWarn = checks.some((check) => check.status === "warn");

  console.log("");
  if (hasError) {
    console.log("Doctor summary: issues found that can block usage.");
  } else if (hasWarn) {
    console.log("Doctor summary: setup is usable with recommendations.");
  } else {
    console.log("Doctor summary: environment looks good.");
  }
}
