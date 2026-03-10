import type { ArchitectureModel, ArchitectureNode } from "@node-hexa/model";
import path from "node:path";

export type ViolationSeverity = "critical" | "high" | "medium";

export type RuleViolation = {
  message: string;
  node: string;
  filePath: string;
  severity: ViolationSeverity;
  /** Actionable guidance to fix the violation. */
  suggestion?: string;
};

const SEVERITY_PENALTY: Record<ViolationSeverity, number> = {
  critical: 25,
  high: 15,
  medium: 10,
};

function findNodeByImport(
  importPath: string,
  sourceFilePath: string,
  nodes: ArchitectureNode[],
): ArchitectureNode | undefined {
  // Non-relative imports (e.g. "@nestjs/common", "rxjs") are external packages
  // and will never correspond to a project node — skip them entirely.
  if (!importPath.startsWith(".")) return undefined;

  // Strip TypeScript extensions from the import specifier when present
  const importNoExt = importPath.replace(/\.(ts|tsx|d\.ts)$/, "");

  // Resolve the import to an absolute path relative to the source file's directory.
  const sourceDir = path.dirname(path.resolve(sourceFilePath));
  const resolvedImport = path.resolve(sourceDir, importNoExt).toLowerCase();

  return nodes.find((n) => {
    const nodePathNoExt = path.resolve(n.filePath)
      .replace(/\.(ts|tsx|d\.ts)$/, "")
      .toLowerCase();

    // Exact match OR barrel-import match (`import './foo'` → `./foo/index.ts`)
    return (
      nodePathNoExt === resolvedImport ||
      nodePathNoExt === resolvedImport + "/index"
    );
  });
}

/**
 * Extract the bounded-context name from a file path.
 * Looks for the first segment matching a known layer keyword, then returns
 * the segment immediately before it (= the context name in standard structure).
 * e.g. `.../contexts/iam/domain/entities/user.entity.ts` → "iam"
 */
function detectContextFromPath(filePath: string): string | null {
  const parts = filePath.replaceAll("\\", "/").split("/");
  const layerKeywords = ["domain", "application", "infrastructure"];
  const idx = parts.findIndex((p) => layerKeywords.includes(p));
  if (idx <= 0) return null;
  return parts[idx - 1];
}

function isOuterLayer(layer: string): boolean {
  return (
    layer === "infrastructure" ||
    layer === "adapter-in" ||
    layer === "adapter-out"
  );
}

// ─── Layer dependency rules ───────────────────────────────────────────────────

function checkLayerViolation(
  node: ArchitectureNode,
  target: ArchitectureNode,
  violations: RuleViolation[],
): void {
  if (node.layer === "domain" && isOuterLayer(target.layer)) {
    violations.push({
      message: "Domain must not depend on infrastructure",
      node: node.name,
      filePath: node.filePath,
      severity: "critical",
      suggestion:
        "Extract a port interface in domain/ports/ and inject the implementation via DI — domain must remain framework-free",
    });
    return;
  }

  if (node.layer === "domain" && target.layer === "application") {
    violations.push({
      message: "Domain must not depend on application",
      node: node.name,
      filePath: node.filePath,
      severity: "critical",
      suggestion:
        "Remove the application import from your domain class — domain must never depend on orchestration logic",
    });
    return;
  }

  if (node.layer === "application" && isOuterLayer(target.layer)) {
    violations.push({
      message: "Application must not depend on infrastructure",
      node: node.name,
      filePath: node.filePath,
      severity: "high",
      suggestion:
        "Inject a port interface (declared in domain/ports/) instead — let the module wire the concrete adapter",
    });
  }
}

// ─── Framework pollution rules ────────────────────────────────────────────────

function checkFrameworkViolations(
  node: ArchitectureNode,
  violations: RuleViolation[],
): void {
  const ormFrameworks = ["prisma", "mongoose", "typeorm", "mikro-orm", "sequelize"];

  // Domain layer: forbid ALL framework imports (including NestJS)
  if (node.layer === "domain") {
    const domainForbidden = ["@nestjs", "express", ...ormFrameworks];
    for (const imp of node.imports) {
      if (domainForbidden.some((f) => imp.includes(f))) {
        violations.push({
          message: "Domain must not depend on frameworks",
          node: node.name,
          filePath: node.filePath,
          severity: "critical",
          suggestion:
            "Keep domain classes as pure TypeScript — no ORM, no HTTP framework. Define a port interface and implement it in the infrastructure layer",
        });
        break;
      }
    }
    return;
  }

  // Application layer: ORM/HTTP frameworks are forbidden; @nestjs DI decorators are allowed
  if (node.layer === "application") {
    for (const imp of node.imports) {
      if (ormFrameworks.some((f) => imp.includes(f))) {
        violations.push({
          message: "Application must not depend on ORM or database frameworks",
          node: node.name,
          filePath: node.filePath,
          severity: "critical",
          suggestion:
            "Move the database logic to adapter-out (persistence layer) and inject a repository port instead",
        });
        break;
      }
    }
  }
}

// ─── Component misplacement rules ─────────────────────────────────────────────

function checkMisplacement(
  node: ArchitectureNode,
  violations: RuleViolation[],
): void {
  const { kind, layer, name, filePath } = node;

  // Nodes with undetermined kind skip misplacement checks
  if (kind === "unknown") return;

  if ((kind === "entity" || kind === "value-object") && layer !== "domain") {
    violations.push({
      message: `${kind === "entity" ? "Entity" : "Value object"} must live in domain layer`,
      node: name,
      filePath,
      severity: "critical",
      suggestion: `Move to contexts/<ctx>/domain/${kind === "entity" ? "entities" : "value-objects"}/ — these are core domain concepts and must stay framework-free`,
    });
    return;
  }

  if (kind === "port" && layer !== "domain") {
    violations.push({
      message: "Port (interface) must live in domain layer",
      node: name,
      filePath,
      severity: "critical",
      suggestion:
        "Move to contexts/<ctx>/domain/ports/ — port interfaces define the contract that infrastructure must fulfill",
    });
    return;
  }

  if (kind === "use-case" && layer !== "application") {
    violations.push({
      message: "UseCase must live in application layer",
      node: name,
      filePath,
      severity: "critical",
      suggestion:
        "Move to contexts/<ctx>/application/use-cases/ — use-cases orchestrate domain logic and must never live inside domain or infrastructure",
    });
    return;
  }

  if (kind === "controller" && (layer === "domain" || layer === "application")) {
    violations.push({
      message: `Controller must not live in ${layer} layer`,
      node: name,
      filePath,
      severity: kind === "controller" && layer === "domain" ? "critical" : "high",
      suggestion:
        "Move to contexts/<ctx>/infrastructure/http/ (adapter-in) — controllers are an HTTP-layer concern, not business logic",
    });
    return;
  }

  if (kind === "repository" && layer === "domain") {
    violations.push({
      message: "Repository implementation must not live in domain layer — extract a port",
      node: name,
      filePath,
      severity: "critical",
      suggestion:
        "Move the implementation to contexts/<ctx>/infrastructure/persistence/ and define an interface (port) in domain/ports/ — domain must never contain infrastructure",
    });
    return;
  }

  if (kind === "module" && (layer === "domain" || layer === "application")) {
    violations.push({
      message: "NestJS Module (composition root) must not live in domain or application layer",
      node: name,
      filePath,
      severity: "high",
      suggestion:
        "Move to the context root: contexts/<ctx>/<ctx>.module.ts — modules wire infrastructure and must not pollute domain or application",
    });
  }
}

// ─── Cross-context import rules ───────────────────────────────────────────────

function checkCrossContextImport(
  node: ArchitectureNode,
  target: ArchitectureNode,
  violations: RuleViolation[],
): void {
  const srcCtx = detectContextFromPath(node.filePath);
  const tgtCtx = detectContextFromPath(target.filePath);

  if (!srcCtx || !tgtCtx || srcCtx === tgtCtx) return;

  // Cross-context dependency is only allowed when the target is a domain port
  if (target.kind !== "port" || target.layer !== "domain") {
    violations.push({
      message: `Cross-context dependency — '${srcCtx}' directly imports '${target.name}' from '${tgtCtx}'`,
      node: node.name,
      filePath: node.filePath,
      severity: "high",
      suggestion:
        `Define a shared port or anti-corruption layer — bounded contexts must communicate via abstractions (ports), not by importing each other's internals`,
    });
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function runRules(
  model: ArchitectureModel,
  strict = true,
): RuleViolation[] {
  const violations: RuleViolation[] = [];

  for (const node of model.nodes) {
    for (const imp of node.imports) {
      const target = findNodeByImport(imp, node.filePath, model.nodes);
      if (target) {
        checkLayerViolation(node, target, violations);
        checkCrossContextImport(node, target, violations);
      }
    }

    checkFrameworkViolations(node, violations);
    checkMisplacement(node, violations);
  }

  return strict
    ? violations
    : violations.filter((v) => v.severity !== "medium");
}

export function computeScore(violations: RuleViolation[]) {
  const penalty = violations.reduce(
    (sum, v) => sum + SEVERITY_PENALTY[v.severity],
    0,
  );

  return {
    score: Math.max(100 - penalty, 0),
    max: 100,
  };
}

// ─── Clean Code rules ─────────────────────────────────────────────────────────

const CLEAN_MAX_CONSTRUCTOR_PARAMS = 4;
const CLEAN_MAX_METHODS = 10;
const CLEAN_MAX_IMPORTS = 10;
const CLEAN_MAX_LINES_CORE = 200;   // domain / application
const CLEAN_MAX_LINES_OUTER = 300;  // infra / adapters / unknown

export function runCleanCodeRules(model: ArchitectureModel): RuleViolation[] {
  const violations: RuleViolation[] = [];
  // Track which files have already been flagged for file-level issues
  const checkedFiles = new Set<string>();

  for (const node of model.nodes) {
    const { metrics, name, filePath, layer, imports } = node;

    // ── File-level checks (once per file) ──────────────────────────────────
    if (!checkedFiles.has(filePath)) {
      checkedFiles.add(filePath);

      // Too many imports → high coupling
      if (imports.length > CLEAN_MAX_IMPORTS) {
        violations.push({
          message: `File has ${imports.length} imports — high coupling detected`,
          node: name,
          filePath,
          severity: "medium",
          suggestion: `Reduce dependencies: use port interfaces and inject through DI, or split the file. Aim for fewer than ${CLEAN_MAX_IMPORTS + 1} imports per file.`,
        });
      }

      // File too long for the layer
      const maxLines =
        layer === "domain" || layer === "application"
          ? CLEAN_MAX_LINES_CORE
          : CLEAN_MAX_LINES_OUTER;
      if ((metrics?.lineCount ?? 0) > maxLines) {
        violations.push({
          message: `File has ${metrics?.lineCount} lines — exceeds the ${maxLines}-line limit for ${layer} layer`,
          node: name,
          filePath,
          severity: "medium",
          suggestion:
            layer === "domain" || layer === "application"
              ? "Domain and application classes should be small. Extract value objects, helper services, or split the use-case."
              : "Consider splitting infrastructure adapters into focused handlers. One repository per aggregate.",
        });
      }
    }

    // ── Class-level checks ────────────────────────────────────────────────
    if (!metrics) continue;

    // Too many constructor parameters → too many dependencies (SRP / DIP)
    if ((metrics.constructorParamCount ?? 0) > CLEAN_MAX_CONSTRUCTOR_PARAMS) {
      violations.push({
        message: `Constructor has ${metrics.constructorParamCount} parameters — too many direct dependencies`,
        node: name,
        filePath,
        severity: "high",
        suggestion:
          "Introduce a Facade or Command object to group related dependencies. Each class should depend only on what it directly uses.",
      });
    }

    // Class has too many methods → SRP violation
    if ((metrics.methodCount ?? 0) > CLEAN_MAX_METHODS) {
      violations.push({
        message: `Class has ${metrics.methodCount} methods — likely violates Single Responsibility Principle`,
        node: name,
        filePath,
        severity: "medium",
        suggestion:
          "Extract focused cohesive methods into a separate class. Each class should have one reason to change.",
      });
    }
  }

  return violations;
}

// ─── Green Code rules (eco-design) ───────────────────────────────────────────

const GREEN_MAX_LINES = 300;
const GREEN_MAX_IMPORTS = 15;
const GREEN_MAX_CLASSES_PER_FILE = 2;

export function runGreenCodeRules(model: ArchitectureModel): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const checkedFiles = new Set<string>();

  // Pre-compute class count per file (only real class nodes have methodCount)
  const fileClassCount = new Map<string, number>();
  for (const node of model.nodes) {
    if (node.metrics?.methodCount !== undefined) {
      fileClassCount.set(
        node.filePath,
        (fileClassCount.get(node.filePath) ?? 0) + 1,
      );
    }
  }

  for (const node of model.nodes) {
    const { metrics, name, filePath, imports } = node;

    if (checkedFiles.has(filePath)) continue;
    checkedFiles.add(filePath);

    // Large files must be loaded and parsed fully in memory → GC pressure
    if ((metrics?.lineCount ?? 0) > GREEN_MAX_LINES) {
      violations.push({
        message: `File has ${metrics?.lineCount} lines — large files increase memory footprint and garbage-collection pressure`,
        node: name,
        filePath,
        severity: "medium",
        suggestion:
          "Split into smaller files. Smaller modules enable better tree-shaking, reduce heap allocation and improve cold-start performance.",
      });
    }

    // Excessive imports → larger dependency graph, slower startup, more code to parse
    if (imports.length > GREEN_MAX_IMPORTS) {
      violations.push({
        message: `File has ${imports.length} imports — excessive dependencies slow parse time and increase cold-start energy consumption`,
        node: name,
        filePath,
        severity: "medium",
        suggestion:
          "Group related collaborators through abstractions (ports, facades). Each unnecessary import adds to parse cost on every server start.",
      });
    }

    // Multiple production classes per file → prevents tree-shaking
    const classCount = fileClassCount.get(filePath) ?? 0;
    if (classCount > GREEN_MAX_CLASSES_PER_FILE) {
      violations.push({
        message: `File defines ${classCount} classes — bundlers cannot tree-shake unused exports when multiple classes share a module`,
        node: name,
        filePath,
        severity: "medium",
        suggestion:
          "One class per file. This enables bundlers (Webpack, esbuild, Rollup) to eliminate dead code and reduces the amount of JS shipped and executed.",
      });
    }
  }

  return violations;
}

