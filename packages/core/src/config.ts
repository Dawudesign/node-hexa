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
