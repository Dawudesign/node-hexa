import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

export type AuditEngineConfig = {
  architecture: {
    hexagonal: boolean;
    ddd: boolean;
  };
  rules: {
    forbiddenDependencies: string[];
    enforcePorts: boolean;
    enforceUseCases: boolean;
    ignoredRules: string[];
  };
  qualityGate: {
    minScore: number;
  };
};

const DEFAULT_AUDIT_CONFIG: AuditEngineConfig = {
  architecture: {
    hexagonal: true,
    ddd: true,
  },
  rules: {
    forbiddenDependencies: ["infra -> domain", "controller -> repository"],
    enforcePorts: true,
    enforceUseCases: true,
    ignoredRules: [],
  },
  qualityGate: {
    minScore: 80,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_AUDIT_CONFIG.qualityGate.minScore;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function mergeAuditConfig(
  base: AuditEngineConfig,
  partial: unknown,
): AuditEngineConfig {
  if (!isRecord(partial)) return base;

  const architecture = isRecord(partial.architecture)
    ? partial.architecture
    : {};
  const rules = isRecord(partial.rules) ? partial.rules : {};
  const qualityGate = isRecord(partial.qualityGate) ? partial.qualityGate : {};

  const forbiddenDependencies = Array.isArray(rules.forbiddenDependencies)
    ? rules.forbiddenDependencies.filter(
        (item): item is string => typeof item === "string",
      )
    : base.rules.forbiddenDependencies;

  const ignoredRules = Array.isArray(rules.ignoredRules)
    ? rules.ignoredRules.filter(
        (item): item is string => typeof item === "string",
      )
    : base.rules.ignoredRules;

  const minScore =
    typeof qualityGate.minScore === "number"
      ? qualityGate.minScore
      : base.qualityGate.minScore;

  return {
    architecture: {
      hexagonal:
        typeof architecture.hexagonal === "boolean"
          ? architecture.hexagonal
          : base.architecture.hexagonal,
      ddd:
        typeof architecture.ddd === "boolean"
          ? architecture.ddd
          : base.architecture.ddd,
    },
    rules: {
      forbiddenDependencies,
      enforcePorts:
        typeof rules.enforcePorts === "boolean"
          ? rules.enforcePorts
          : base.rules.enforcePorts,
      enforceUseCases:
        typeof rules.enforceUseCases === "boolean"
          ? rules.enforceUseCases
          : base.rules.enforceUseCases,
      ignoredRules,
    },
    qualityGate: {
      minScore: clampScore(minScore),
    },
  };
}

function extractDefaultExportExpression(tsCode: string): string {
  const normalized = tsCode.trim().replace(/^\uFEFF/, "");
  const exportDefaultIndex = normalized.indexOf("export default");

  if (exportDefaultIndex === -1) {
    throw new Error("node-hexa.config.ts must export a default object");
  }

  let expression = normalized
    .slice(exportDefaultIndex + "export default".length)
    .trim();

  if (expression.endsWith(";")) {
    expression = expression.slice(0, -1).trim();
  }

  // Keep the loader lightweight: support object-literal configs with optional "as const".
  expression = expression.replaceAll(/\s+as\s+const\b/g, "").trim();

  return expression;
}

function parseTsConfigFile(configPath: string): unknown {
  const fileContents = fs.readFileSync(configPath, "utf8");
  const expression = extractDefaultExportExpression(fileContents);

  return vm.runInNewContext(`(${expression})`, Object.create(null), {
    timeout: 200,
  });
}

function parseJsonConfigFile(configPath: string): unknown {
  const raw = fs.readFileSync(configPath, "utf8");
  return JSON.parse(raw) as unknown;
}

export function loadAuditEngineConfig(projectPath: string): AuditEngineConfig {
  const jsonPath = path.join(projectPath, "node-hexa.config.json");
  const tsPath = path.join(projectPath, "node-hexa.config.ts");

  let config = DEFAULT_AUDIT_CONFIG;

  if (fs.existsSync(jsonPath)) {
    try {
      config = mergeAuditConfig(config, parseJsonConfigFile(jsonPath));
    } catch (error) {
      throw new Error(
        `Failed to parse node-hexa.config.json at "${jsonPath}": ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }

  if (fs.existsSync(tsPath)) {
    try {
      config = mergeAuditConfig(config, parseTsConfigFile(tsPath));
    } catch (error) {
      throw new Error(
        `Failed to parse node-hexa.config.ts at "${tsPath}": ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }

  return config;
}

export const defaultAuditEngineConfig = DEFAULT_AUDIT_CONFIG;
