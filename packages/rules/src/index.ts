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
    const nodePathNoExt = path
      .resolve(n.filePath)
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
    return;
  }

  if (node.layer === "adapter-in" && target.layer === "adapter-out") {
    violations.push({
      message: "Adapter-in must not depend on adapter-out",
      node: node.name,
      filePath: node.filePath,
      severity: "high",
      suggestion:
        "Controllers (adapter-in) must invoke use cases, not repository adapters directly — route through application/use-cases/ and inject a port",
    });
  }
}

// ─── Framework pollution rules ────────────────────────────────────────────────

function checkFrameworkViolations(
  node: ArchitectureNode,
  violations: RuleViolation[],
): void {
  const ormFrameworks = [
    "prisma",
    "mongoose",
    "typeorm",
    "mikro-orm",
    "sequelize",
  ];

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

/**
 * Infer component kind purely from directory name conventions.
 * Used as a fallback inside misplacement checks when the node kind is "unknown".
 *
 * Intentionally wider than kindFromLocation in @node-hexa/core: misplacement
 * checks must catch components that the parser/name-based detector could not
 * label (e.g. files in persistence/ or http/ folders without a typed name).
 * Do NOT merge with kindFromLocation — the two serve different purposes.
 */
function kindFromPath(filePath: string): import("@node-hexa/model").ComponentKind {
  const dir = filePath.replaceAll("\\", "/").toLowerCase();
  if (dir.includes("/entities/") || dir.includes("/entities")) return "entity";
  if (dir.includes("/value-objects/") || dir.includes("/value-objects")) return "value-object";
  if (dir.includes("/use-cases/") || dir.includes("/use-cases")) return "use-case";
  if (dir.includes("/ports/") || dir.includes("/ports")) return "port";
  if (dir.includes("/persistence/") || dir.includes("/repository/") || dir.includes("/repositories/")) return "repository";
  if (dir.includes("/http/") || dir.includes("/controllers/") || dir.includes("/rest/") || dir.includes("/graphql/")) return "controller";
  return "unknown";
}

function checkMisplacement(
  node: ArchitectureNode,
  violations: RuleViolation[],
): void {
  const { kind, layer, name, filePath } = node;

  // Effective kind: if detection was inconclusive, use directory path as a hint
  const effectiveKind = kind === "unknown" ? kindFromPath(filePath) : kind;

  // Nodes with truly undetermined kind skip misplacement checks
  if (effectiveKind === "unknown") return;

  if ((effectiveKind === "entity" || effectiveKind === "value-object") && layer !== "domain") {
    violations.push({
      message: `${effectiveKind === "entity" ? "Entity" : "Value object"} must live in domain layer`,
      node: name,
      filePath,
      severity: "critical",
      suggestion: `Move to contexts/<ctx>/domain/${effectiveKind === "entity" ? "entities" : "value-objects"}/ — these are core domain concepts and must stay framework-free`,
    });
    return;
  }

  if (effectiveKind === "port" && layer !== "domain") {
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

  if (effectiveKind === "use-case" && layer !== "application") {
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

  if (
    effectiveKind === "controller" &&
    (layer === "domain" || layer === "application")
  ) {
    violations.push({
      message: `Controller must not live in ${layer} layer`,
      node: name,
      filePath,
      severity: layer === "domain" ? "critical" : "high",
      suggestion:
        "Move to contexts/<ctx>/infrastructure/http/ (adapter-in) — controllers are an HTTP-layer concern, not business logic",
    });
    return;
  }

  if (effectiveKind === "repository" && layer === "domain") {
    violations.push({
      message:
        "Repository implementation must not live in domain layer — extract a port",
      node: name,
      filePath,
      severity: "critical",
      suggestion:
        "Move the implementation to contexts/<ctx>/infrastructure/persistence/ and define an interface (port) in domain/ports/ — domain must never contain infrastructure",
    });
    return;
  }

  if (effectiveKind === "domain-event" && layer !== "domain") {
    violations.push({
      message: "Domain event must live in domain layer",
      node: name,
      filePath,
      severity: "critical",
      suggestion:
        "Move to contexts/<ctx>/domain/events/ — domain events are part of the ubiquitous language and must remain framework-free",
    });
    return;
  }

  if (effectiveKind === "entity" && layer === "domain" && node.metrics?.hasIdProperty === false) {
    violations.push({
      message: `Entity '${name}' has no 'id' property — aggregate roots must have a unique identity`,
      node: name,
      filePath,
      severity: "high",
      suggestion:
        "Add a public readonly 'id' property (or constructor parameter) to uniquely identify this entity. Use a value object (e.g. UserId) for strong typing.",
    });
  }

  if (effectiveKind === "module" && (layer === "domain" || layer === "application")) {
    violations.push({
      message:
        "Module (composition root) must not live in domain or application layer",
      node: name,
      filePath,
      severity: "high",
      suggestion:
        "Move to the context root: contexts/<ctx>/<ctx>.module.ts — composition root modules wire infrastructure and must not pollute domain or application",
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
      suggestion: `Define a shared port or anti-corruption layer — bounded contexts must communicate via abstractions (ports), not by importing each other's internals`,
    });
  }
}

// ─── Cyclic import rules ──────────────────────────────────────────────────────

function checkCyclicImports(
  model: ArchitectureModel,
  violations: RuleViolation[],
): void {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const stackPath: ArchitectureNode[] = [];
  const reportedCycles = new Set<string>();

  function dfs(node: ArchitectureNode): void {
    const key = node.filePath.toLowerCase();

    if (inStack.has(key)) {
      const cycleStartIdx = stackPath.findIndex(
        (n) => n.filePath.toLowerCase() === key,
      );
      if (cycleStartIdx === -1) return;

      const cycleNodes = stackPath.slice(cycleStartIdx);
      const signature = cycleNodes
        .map((n) => n.filePath)
        .sort()
        .join("|");
      if (reportedCycles.has(signature)) return;
      reportedCycles.add(signature);

      const cyclePath =
        cycleNodes.map((n) => n.name).join(" → ") + " → " + node.name;
      violations.push({
        message: `Cyclic import detected: ${cyclePath}`,
        node: cycleNodes[0].name,
        filePath: cycleNodes[0].filePath,
        severity: "high",
        suggestion:
          "Break the cycle by extracting a shared abstraction (port interface or DTO) that both sides can depend on without creating a circular reference",
      });
      return;
    }

    if (visited.has(key)) return;

    inStack.add(key);
    stackPath.push(node);

    for (const imp of node.imports) {
      const target = findNodeByImport(imp, node.filePath, model.nodes);
      if (target) {
        dfs(target);
      }
    }

    stackPath.pop();
    inStack.delete(key);
    visited.add(key);
  }

  for (const node of model.nodes) {
    if (!visited.has(node.filePath.toLowerCase())) {
      dfs(node);
    }
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

  checkCyclicImports(model, violations);

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
const CLEAN_MAX_LINES_CORE = 200; // domain / application
const CLEAN_MAX_LINES_OUTER = 300; // infra / adapters / unknown

export function runCleanCodeRules(model: ArchitectureModel): RuleViolation[] {
  const violations: RuleViolation[] = [];
  // Track which files have already been flagged for file-level issues
  const checkedFiles = new Set<string>();

  for (const node of model.nodes) {
    const { metrics, name, filePath, layer, kind, imports } = node;

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

    // Value object mutability — all public properties must be readonly (DDD immutability rule)
    if (
      (kind === "value-object") &&
      metrics.hasMutablePublicProperties === true
    ) {
      violations.push({
        message: `Value object '${name}' has mutable public properties — value objects must be immutable`,
        node: name,
        filePath,
        severity: "high",
        suggestion:
          "Mark all public properties as 'readonly'. Value objects represent concepts without identity — their state must never change after construction.",
      });
    }
  }

  return violations;
}

// ─── Performance rules ────────────────────────────────────────────────────────

const PERF_MAX_CONSTRUCTOR_PARAMS = 5;  // >5 → wide DI tree, slow startup
const PERF_MAX_USECASE_METHODS = 5;     // use-case should expose 1 execute() method
const PERF_MAX_INFRA_LINES = 500;       // large adapters hold big closures in memory
const PERF_MAX_CROSS_CONTEXT_IMPORTS = 2; // >2 cross-context → cascade module loading

export function runPerfRules(model: ArchitectureModel): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const checkedFiles = new Set<string>();

  for (const node of model.nodes) {
    const { metrics, name, filePath, layer, kind, imports } = node;

    // ── 1. Heavy DI constructor ────────────────────────────────────────────
    // NestJS resolves the full dependency tree at startup; wide constructors
    // create O(n²) resolution chains and slow boot time.
    if ((metrics?.constructorParamCount ?? 0) > PERF_MAX_CONSTRUCTOR_PARAMS) {
      violations.push({
        message: `Constructor has ${metrics!.constructorParamCount} injected dependencies — wide DI trees slow NestJS startup`,
        node: name,
        filePath,
        severity: "high",
        suggestion:
          `Reduce constructor params to ${PERF_MAX_CONSTRUCTOR_PARAMS} or fewer. Group related dependencies behind a Facade service or split the class into focused units. Each extra injected dep adds transitive resolution cost at boot.`,
      });
    }

    // ── 2. Bloated use-case ────────────────────────────────────────────────
    // A use-case should expose exactly one execute() method.
    // Extra methods mean more code is parsed and loaded eagerly, even when
    // only one path is invoked per request.
    if (
      kind === "use-case" &&
      (metrics?.methodCount ?? 0) > PERF_MAX_USECASE_METHODS
    ) {
      violations.push({
        message: `Use-case '${name}' has ${metrics!.methodCount} methods — a use-case should do one thing`,
        node: name,
        filePath,
        severity: "high",
        suggestion:
          "Extract each operation into its own dedicated use-case class. One class, one execute() method. This keeps the instantiation graph small and each request path lean.",
      });
    }

    // ── 3. Large infrastructure adapter ───────────────────────────────────
    // Large infra files keep a big closure in the V8 heap for the lifetime
    // of the process. They also make JIT compilation slower.
    if (
      !checkedFiles.has(filePath) &&
      (layer === "infrastructure" || layer === "adapter-out") &&
      (metrics?.lineCount ?? 0) > PERF_MAX_INFRA_LINES
    ) {
      checkedFiles.add(filePath);
      violations.push({
        message: `Infrastructure file has ${metrics!.lineCount} lines — large adapters increase heap allocation and JIT compilation cost`,
        node: name,
        filePath,
        severity: "medium",
        suggestion:
          "Split into focused single-aggregate repositories or dedicated adapter classes. One repository per aggregate root keeps each file small and independently loadable.",
      });
    }

    // ── 4. Cross-context fan-out ───────────────────────────────────────────
    // A file importing from more than PERF_MAX_CROSS_CONTEXT_IMPORTS distinct
    // bounded contexts creates a wide loading cascade at startup: each context
    // must be fully resolved before this module can initialise.
    if (!checkedFiles.has(filePath)) {
      checkedFiles.add(filePath);
      const sourceCtx = detectContextFromPath(filePath);
      if (sourceCtx) {
        const importedContexts = new Set<string>();
        for (const imp of imports) {
          if (!imp.startsWith(".")) continue;
          const resolved = (() => {
            try {
              return path.resolve(path.dirname(path.resolve(filePath)), imp);
            } catch {
              return null;
            }
          })();
          if (!resolved) continue;
          const target = model.nodes.find((n) => {
            const noExt = path
              .resolve(n.filePath)
              .replace(/\.(ts|tsx|d\.ts)$/, "")
              .toLowerCase();
            const impNoExt = resolved.replace(/\.(ts|tsx|d\.ts)$/, "").toLowerCase();
            return noExt === impNoExt || noExt === impNoExt + "/index";
          });
          if (!target) continue;
          const targetCtx = detectContextFromPath(target.filePath);
          if (targetCtx && targetCtx !== sourceCtx) {
            importedContexts.add(targetCtx);
          }
        }
        if (importedContexts.size > PERF_MAX_CROSS_CONTEXT_IMPORTS) {
          violations.push({
            message: `'${name}' imports from ${importedContexts.size} bounded contexts — cross-context fan-out creates startup loading cascades`,
            node: name,
            filePath,
            severity: "high",
            suggestion:
              "A single class should depend on at most one or two external contexts. Introduce an anti-corruption layer or shared kernel module so each import resolves locally.",
          });
        }
      }
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
