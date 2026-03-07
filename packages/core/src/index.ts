import { parseProject } from "@node-hexa/parser";
import { loadConfig, type HexaConfig } from "./config";
import { computeScore, runRules } from "@node-hexa/rules";
import type { ArchitectureModel, Layer, ComponentKind } from "@node-hexa/model";
import path from "node:path";

function detectLayer(filePath: string, config: HexaConfig): Layer {
  const normalized = filePath.toLowerCase().replaceAll("\\", "/");
  // Use only the directory path (without filename) to avoid false positives
  // e.g. 'user.repository.port.ts' must not match adapterOut keyword 'repository'
  const dirPath = normalized.split("/").slice(0, -1).join("/");

  // Structural hexagonal layers take priority — matched against directory path
  if (config.layers.domain.some((l: string) => dirPath.includes(l)))
    return "domain";

  if (config.layers.application.some((l: string) => dirPath.includes(l)))
    return "application";

  // Adapter keywords are matched against directory path only
  if (config.layers.adapterIn?.some((l: string) => dirPath.includes(l)))
    return "adapter-in";

  if (config.layers.adapterOut?.some((l: string) => dirPath.includes(l)))
    return "adapter-out";

  if (config.layers.infrastructure.some((l: string) => dirPath.includes(l)))
    return "infrastructure";

  return "unknown";
}

function detectKind(name: string, decorators: string[]): ComponentKind {
  if (decorators.includes("Controller")) return "controller";
  if (decorators.includes("Injectable")) return "service";
  if (decorators.includes("Module")) return "module";

  if (name.endsWith("Controller")) return "controller";
  if (name.endsWith("UseCase")) return "use-case";
  if (name.endsWith("Repository")) return "repository";
  if (name.endsWith("Entity")) return "entity";
  if (name.endsWith("Service")) return "service";
  if (name.endsWith("Port")) return "port";
  if (name.endsWith("Adapter")) return "adapter";
  if (
    name.endsWith("Vo") ||
    name.endsWith("ValueObject") ||
    name.endsWith("Id")
  )
    return "value-object";

  return "unknown";
}

export async function analyzeProject(projectPath: string) {
  const parsed = await parseProject(projectPath);

  const config = loadConfig(projectPath);

  const contextsAbsDir = path.resolve(projectPath, config.contextsDir);

  const nodes = parsed.files
    .filter((file) => {
      const normalizedPath = path.normalize(file.path);
      return normalizedPath.startsWith(contextsAbsDir + path.sep) || normalizedPath === contextsAbsDir;
    })
    .flatMap((file) => [
      ...file.classes.map((cls) => ({
        name: cls.name,
        filePath: file.path,
        layer: detectLayer(file.path, config),
        kind: detectKind(cls.name, cls.decorators),
        imports: file.imports,
      })),
      ...file.interfaces.map((itf) => ({
        name: itf,
        filePath: file.path,
        layer: detectLayer(file.path, config),
        kind: "port" as ComponentKind,
        imports: file.imports,
      })),
    ]);

  const model: ArchitectureModel = { nodes };

  const violations = runRules(model, config.strict);
  const score = computeScore(violations);

  return {
    model,
    violations,
    score,
  };
}

export { generateMermaidGraph } from "./mermaid";
export { generateDocs } from "./docs";
export { generateGraphFile } from "./graph";
export { detectContexts } from "./context";
export { generateProject } from "./init";
export { generateContext } from "./generate-context";
export { generateUseCase } from "./generate-usecase";
export { generateAggregate } from "./generate-aggregate";
export { listContexts } from "./list";
export type { ContextSummary } from "./list";
export type { RuleViolation } from "@node-hexa/rules";
