import { parseProject } from "@node-hexa/parser";
import { loadConfig, validateConfig, type HexaConfig } from "./config";
import { computeScore, runRules, runCleanCodeRules, runGreenCodeRules } from "@node-hexa/rules";
import type { ArchitectureModel, Layer, ComponentKind } from "@node-hexa/model";
import path from "node:path";
import fs from "node:fs";

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

/**
 * Narrow path-based kind fallback used only when name- and decorator-based
 * detection returns "unknown". Covers only the four unambiguous structural
 * directories (entities, value-objects, use-cases, ports).
 *
 * Intentionally narrower than kindFromPath in @node-hexa/rules: persistence/
 * and http/ directories are deliberately excluded here because name-based
 * detection already handles Repository/Controller classes; over-classifying
 * by path would cause false positives.
 * Do NOT merge with kindFromPath in rules — the two serve different purposes.
 */
function kindFromLocation(filePath: string): ComponentKind {
  const dir = filePath.toLowerCase().replaceAll("\\", "/").split("/").slice(0, -1).join("/");
  if (dir.includes("/entities") || dir.endsWith("/entities")) return "entity";
  if (dir.includes("/value-objects") || dir.endsWith("/value-objects")) return "value-object";
  if (dir.includes("/use-cases") || dir.endsWith("/use-cases")) return "use-case";
  if (dir.includes("/ports") || dir.endsWith("/ports")) return "port";
  return "unknown";
}

function detectKind(name: string, decorators: string[], filePath: string): ComponentKind {
  // Name-based detection is most specific — always takes priority over decorators
  if (name.endsWith("Controller")) return "controller";
  if (name.endsWith("UseCase")) return "use-case";
  if (name.endsWith("Repository")) return "repository";
  if (name.endsWith("Entity")) return "entity";
  if (name.endsWith("Service")) return "service";
  if (name.endsWith("Port")) return "port";
  if (name.endsWith("Adapter")) return "adapter";
  if (name.endsWith("Event") || name.endsWith("DomainEvent")) return "domain-event";
  // "Module" suffix alone is not enough — only classify as module if the @Module decorator
  // is present (NestJS-specific). Plain classes named *Module in Next.js or non-NestJS
  // projects must not trigger the module misplacement rule.
  if (
    name.endsWith("Vo") ||
    name.endsWith("ValueObject") ||
    name.endsWith("Id")
  )
    return "value-object";

  // Decorator fallback (e.g. anonymous or unusual names)
  if (decorators.includes("Controller")) return "controller";
  if (decorators.includes("Module")) return "module";
  if (decorators.includes("Injectable")) return "service";

  // Location-based fallback: infer from directory conventions
  return kindFromLocation(filePath);
}

function detectInterfaceKind(name: string, filePath: string): ComponentKind {
  // An interface is a port if its name ends with Port OR it lives in a ports directory
  if (name.endsWith("Port")) return "port";
  const dir = filePath.toLowerCase().replaceAll("\\", "/").split("/").slice(0, -1).join("/");
  if (dir.includes("/ports") || dir.endsWith("/ports")) return "port";
  return "unknown";
}

export async function analyzeProject(projectPath: string) {
  const parsed = await parseProject(projectPath);

  const config = loadConfig(projectPath);

  // If the configured contextsDir doesn't exist at the given project root, the
  // user likely passed the contexts directory itself as the project path.
  // Fall back to using the project path directly as the analysis root.
  const configuredContextsDir = path.resolve(projectPath, config.contextsDir);
  const contextsAbsDir = fs.existsSync(configuredContextsDir)
    ? configuredContextsDir
    : path.resolve(projectPath);

  const nodes = parsed.files
    .filter((file) => {
      const normalizedPath = path.normalize(file.path);
      // Exclude test files — they are not part of the production architecture
      if (
        normalizedPath.endsWith(".spec.ts") ||
        normalizedPath.endsWith(".test.ts")
      )
        return false;
      return (
        normalizedPath.startsWith(contextsAbsDir + path.sep) ||
        normalizedPath === contextsAbsDir
      );
    })
    .flatMap((file) => {
      const fileLayer = detectLayer(file.path, config);

      const classNodes = file.classes.map((cls) => ({
        name: cls.name,
        filePath: file.path,
        layer: fileLayer,
        kind: detectKind(cls.name, cls.decorators, file.path),
        imports: file.imports,
        metrics: {
          lineCount: file.lineCount,
          methodCount: cls.methodCount,
          constructorParamCount: cls.constructorParamCount,
          hasMutablePublicProperties: cls.hasMutablePublicProperties,
        },
      }));

      const interfaceNodes = file.interfaces.map((itf) => ({
        name: itf,
        filePath: file.path,
        layer: fileLayer,
        kind: detectInterfaceKind(itf, file.path),
        imports: file.imports,
        metrics: { lineCount: file.lineCount },
      }));

      const namedNodes = [...classNodes, ...interfaceNodes];

      // If the file has no class or interface (e.g. pure type aliases, enums,
      // constants), create a synthetic file-level node so its imports are
      // still checked for layer violations.
      if (namedNodes.length === 0) {
        return [
          {
            name: path.basename(file.path, ".ts"),
            filePath: file.path,
            layer: fileLayer,
            kind: "unknown" as ComponentKind,
            imports: file.imports,
            metrics: { lineCount: file.lineCount },
          },
        ];
      }

      return namedNodes;
    });

  const model: ArchitectureModel = { nodes };

  const violations = runRules(model, config.strict);
  const score = computeScore(violations);
  const cleanViolations = runCleanCodeRules(model);
  const cleanScore = computeScore(cleanViolations);
  const greenViolations = runGreenCodeRules(model);
  const greenScore = computeScore(greenViolations);
  const configIssues = validateConfig(projectPath);

  return {
    model,
    violations,
    score,
    cleanViolations,
    cleanScore,
    greenViolations,
    greenScore,
    configIssues,
  };
}

export { generateMermaidGraph } from "./mermaid";
export { generateDocs } from "./docs";
export { generateGraphFile } from "./graph";
export { detectContexts } from "./context";
export { generateProject } from "./init";
export { generateDemoProject } from "./demo";
export { generateContext } from "./generate-context";
export { generateUseCase } from "./generate-usecase";
export { generateAggregate } from "./generate-aggregate";
export { listContexts } from "./list";
export type { ContextSummary } from "./list";
export {
  buildArchitectureAuditReport,
  compareAuditBaseline,
  createAuditBaseline,
  generateAuditSarif,
  generateAuditBadgeSvg,
  generateAuditHtmlReport,
  readAuditBaseline,
  writeAuditBaseline,
} from "./audit";
export type {
  AuditBaseline,
  AuditBaselineComparison,
  ArchitectureAuditReport,
  AuditAnalysisInput,
  AuditFinding,
  AuditStatus,
} from "./audit";
export {
  loadAuditEngineConfig,
  defaultAuditEngineConfig,
} from "./audit-config";
export type { AuditEngineConfig } from "./audit-config";
export type { RuleViolation } from "@node-hexa/rules";
export { runCleanCodeRules, runGreenCodeRules } from "@node-hexa/rules";
export { validateConfig } from "./config";
export type { ConfigIssue, ConfigIssueSeverity } from "./config";
