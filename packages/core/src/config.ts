import path from "node:path";
import fs from "node:fs";
export type HexaConfig = {
  architecture: "hexagonal-ddd";
  strict: boolean;
  contextsDir: string;
  layers: {
    domain: string[];
    application: string[];
    infrastructure: string[];
    adapterIn: string[];
    adapterOut: string[];
  };
};

export type ConfigIssueSeverity = "error" | "warning";

export type ConfigIssue = {
  field: string;
  message: string;
  suggestion: string;
  severity: ConfigIssueSeverity;
};

export const defaultConfig: HexaConfig = {
  architecture: "hexagonal-ddd",
  strict: true,
  contextsDir: "src/contexts",
  layers: {
    domain: ["domain"],
    application: ["application"],
    infrastructure: ["infrastructure"],
    adapterIn: ["controller", "http", "rest"],
    adapterOut: ["repository", "persistence"],
  },
};

export function loadConfig(projectPath: string): HexaConfig {
  const configPath = path.join(projectPath, "node-hexa.config.json");

  if (!fs.existsSync(configPath)) {
    return defaultConfig;
  }

  let userConfig: Record<string, unknown>;
  try {
    userConfig = JSON.parse(fs.readFileSync(configPath, "utf8")) as Record<string, unknown>;
  } catch {
    throw new Error(`Failed to parse node-hexa.config.json at "${configPath}". Make sure it is valid JSON.`);
  }

  const userLayers = (userConfig.layers && typeof userConfig.layers === "object")
    ? userConfig.layers as Partial<HexaConfig["layers"]>
    : {};

  return {
    architecture: "hexagonal-ddd",
    strict: typeof userConfig.strict === "boolean" ? userConfig.strict : defaultConfig.strict,
    contextsDir: typeof userConfig.contextsDir === "string" && userConfig.contextsDir.length > 0
      ? userConfig.contextsDir
      : defaultConfig.contextsDir,
    layers: {
      ...defaultConfig.layers,
      ...userLayers,
    },
  };
}

export function validateConfig(projectPath: string): ConfigIssue[] {
  const configPath = path.join(projectPath, "node-hexa.config.json");
  const issues: ConfigIssue[] = [];

  if (!fs.existsSync(configPath)) {
    issues.push({
      field: "node-hexa.config.json",
      message: "Configuration file not found — default settings are used",
      suggestion:
        "Create node-hexa.config.json at the project root. Example: { \"architecture\": \"hexagonal-ddd\", \"strict\": true, \"contextsDir\": \"src/contexts\" }",
      severity: "warning",
    });
    return issues;
  }

  const config = loadConfig(projectPath);

  // 1. Check contextsDir exists on disk
  const contextsDir = path.join(projectPath, config.contextsDir);
  if (!fs.existsSync(contextsDir)) {
    issues.push({
      field: "contextsDir",
      message: `Contexts directory "${config.contextsDir}" does not exist`,
      suggestion: `Create the directory '${config.contextsDir}/' or update "contextsDir" in node-hexa.config.json`,
      severity: "error",
    });
  }

  // 2. Required layer arrays must have at least one keyword
  const requiredLayers: Array<[keyof HexaConfig["layers"], string]> = [
    ["domain", "domain"],
    ["application", "application"],
    ["infrastructure", "infrastructure"],
  ];
  for (const [key, example] of requiredLayers) {
    if (config.layers[key].length === 0) {
      issues.push({
        field: `layers.${key}`,
        message: `Layer "${key}" has no keywords — no files will be classified as ${key}`,
        suggestion: `Add at least one keyword in node-hexa.config.json, e.g.: "layers": { "${key}": ["${example}"] }`,
        severity: "error",
      });
    }
  }

  // 3. Detect overlapping keywords across layers
  const layerEntries: Array<[string, string[]]> = [
    ["domain", config.layers.domain],
    ["application", config.layers.application],
    ["infrastructure", config.layers.infrastructure],
    ["adapterIn", config.layers.adapterIn ?? []],
    ["adapterOut", config.layers.adapterOut ?? []],
  ];
  const seen = new Map<string, string>();
  for (const [layerName, keywords] of layerEntries) {
    for (const kw of keywords) {
      if (seen.has(kw)) {
        issues.push({
          field: `layers.${layerName}`,
          message: `Keyword "${kw}" is defined in both "${seen.get(kw)}" and "${layerName}" — layer detection will be ambiguous`,
          suggestion: `Remove "${kw}" from one of the two layers in node-hexa.config.json`,
          severity: "error",
        });
      } else {
        seen.set(kw, layerName);
      }
    }
  }

  // 4. Validate ignoredRules entries against known NXH rule IDs
  let rawJson: Record<string, unknown> = {};
  try {
    rawJson = JSON.parse(fs.readFileSync(configPath, "utf8")) as Record<string, unknown>;
  } catch {
    // already handled above
  }
  const rulesSection = (rawJson.rules && typeof rawJson.rules === "object")
    ? rawJson.rules as Record<string, unknown>
    : {};
  const ignoredRules = Array.isArray(rulesSection.ignoredRules)
    ? (rulesSection.ignoredRules as unknown[]).filter((r): r is string => typeof r === "string")
    : [];

  const KNOWN_RULE_IDS = new Set([
    "NXH001", "NXH002", "NXH003", "NXH004", "NXH005",
    "NXH006", "NXH007", "NXH008", "NXH009", "NXH010",
    "NXH011", "NXH012", "NXH013",
  ]);

  for (const ruleId of ignoredRules) {
    if (!KNOWN_RULE_IDS.has(ruleId.trim().toUpperCase())) {
      issues.push({
        field: "rules.ignoredRules",
        message: `Unknown rule ID '${ruleId}' in ignoredRules — this suppression has no effect`,
        suggestion: `Remove '${ruleId}' or use a valid ID. Known IDs: ${[...KNOWN_RULE_IDS].join(", ")}`,
        severity: "warning",
      });
    }
  }

  return issues;
}

