import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "./config";

export interface ContextSummary {
  name: string;
  entities: string[];
  valueObjects: string[];
  ports: string[];
  useCases: string[];
}

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".spec.ts"))
    .map((f) => f.replace(".ts", ""));
}

export function listContexts(projectPath: string): ContextSummary[] {
  const config = loadConfig(projectPath);
  const contextsDir = path.join(projectPath, config.contextsDir);

  if (!fs.existsSync(contextsDir)) return [];

  return fs
    .readdirSync(contextsDir)
    .filter((entry) =>
      fs.statSync(path.join(contextsDir, entry)).isDirectory(),
    )
    .map((ctxName) => {
      const ctxPath = path.join(contextsDir, ctxName);
      return {
        name: ctxName,
        entities: listFiles(path.join(ctxPath, "domain/entities")),
        valueObjects: listFiles(path.join(ctxPath, "domain/value-objects")),
        ports: listFiles(path.join(ctxPath, "domain/ports")),
        useCases: listFiles(path.join(ctxPath, "application/use-cases")),
      };
    });
}
