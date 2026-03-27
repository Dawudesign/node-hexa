import fs from "node:fs";
import path from "node:path";
import type { ArchitectureNode } from "@node-hexa/model";
import { loadConfig } from "./config";
import {
  loadAuditEngineConfig,
  type AuditEngineConfig,
} from "./audit-config";
import type { RuleViolation } from "@node-hexa/rules";

type AuditSeverity = "ERROR" | "WARNING" | "INFO";
type AuditCategoryKey =
  | "dependencyDirection"
  | "layerIsolation"
  | "namingConventions"
  | "folderStructure"
  | "dddPatterns";
type RuleCategory = "DDD" | "HEXAGONAL" | "DEPENDENCY" | "STRUCTURE";

type CategoryScores = Record<AuditCategoryKey, number>;

type InternalAuditFinding = {
  ruleId: string;
  category: AuditCategoryKey;
  code: string;
  severity: AuditSeverity;
  message: string;
  filePath?: string;
  recommendation: string;
};

export type AuditFinding = {
  ruleId: string;
  category: RuleCategory;
  code: string;
  severity: AuditSeverity;
  message: string;
  filePath?: string;
};

export type AuditStatus = "OK" | "WARNING" | "ERROR";

export type ArchitectureAuditReport = {
  score: number;
  maxScore: number;
  estimatedTechnicalDebtDays: number;
  categoryScores: CategoryScores;
  dddCompliance: AuditStatus;
  hexagonalBoundaries: AuditStatus;
  dependencyViolations: AuditStatus;
  findings: AuditFinding[];
  recommendations: string[];
  config: AuditEngineConfig;
  /** Granular technical debt breakdown by context, category and rule. */
  debtBreakdown: DebtBreakdown;
  /**
   * True when no hexagonal DDD structure was detected in the project.
   * The audit score is meaningless in this case — the project is not
   * a hexagonal DDD project (e.g. Next.js, plain Express, etc.).
   */
  notHexagonal?: boolean;
};

export type AuditBaseline = {
  score: number;
  violations: AuditFinding[];
  ruleIds: string[];
  timestamp: string;
};

export type AuditBaselineComparison = {
  previousScore: number;
  currentScore: number;
  delta: number;
  newViolations: number;
  resolvedViolations: number;
  unchanged: number;
};

export type AuditAnalysisInput = {
  model: { nodes: ArchitectureNode[] };
  violations: RuleViolation[];
};

export type DebtBreakdown = {
  /** Total estimated technical debt in engineer-days. */
  total: number;
  /** Debt per bounded context (context name → days). */
  byContext: Record<string, number>;
  /** Debt per audit category (category key → days). */
  byCategory: Record<string, number>;
  /** Up to 5 most expensive violations sorted by debt cost desc. */
  topViolations: Array<{
    ruleId: string;
    code: string;
    message: string;
    debtDays: number;
    filePath?: string;
  }>;
};

const CATEGORY_WEIGHTS: Record<AuditCategoryKey, number> = {
  dependencyDirection: 35,
  layerIsolation: 25,
  namingConventions: 15,
  folderStructure: 15,
  dddPatterns: 10,
};

const PENALTY_BY_SEVERITY: Record<AuditSeverity, number> = {
  ERROR: 15,
  WARNING: 7,
  INFO: 3,
};

const FINDING_ORDER: Record<AuditSeverity, number> = {
  ERROR: 0,
  WARNING: 1,
  INFO: 2,
};

const RULE_IDS_BY_CODE: Record<string, string> = {
  "dependency-direction": "NXH001",
  "cross-context-coupling": "NXH002",
  "layer-boundary": "NXH003",
  "controller-repository-coupling": "NXH004",
  "forbidden-dependency": "NXH005",
  "usecase-name": "NXH006",
  "controller-name": "NXH007",
  "repository-name": "NXH008",
  "port-name": "NXH009",
  "missing-layer-directory": "NXH010",
  "missing-entity": "NXH011",
  "missing-port": "NXH012",
  "missing-usecase": "NXH013",
};

const DEFAULT_RULE_ID = "NXH999";

/** Per-rule technical debt cost in engineer-days (replaces flat severity-based cost). */
const DEBT_DAYS_BY_CODE: Record<string, number> = {
  "dependency-direction": 1.5,
  "cross-context-coupling": 1.0,
  "layer-boundary": 0.8,
  "controller-repository-coupling": 1.0,
  "forbidden-dependency": 1.0,
  "missing-usecase": 0.8,
  "missing-port": 0.5,
  "missing-entity": 0.5,
  "missing-layer-directory": 0.3,
  "usecase-name": 0.1,
  "controller-name": 0.1,
  "repository-name": 0.1,
  "port-name": 0.1,
};
const DEFAULT_DEBT_DAYS = 0.3;

function debtDaysForCode(code: string): number {
  return DEBT_DAYS_BY_CODE[code] ?? DEFAULT_DEBT_DAYS;
}

function mapRuleCategory(category: AuditCategoryKey): RuleCategory {
  if (category === "dependencyDirection") return "DEPENDENCY";
  if (category === "layerIsolation") return "HEXAGONAL";
  if (category === "dddPatterns") return "DDD";
  return "STRUCTURE";
}

function normalizePath(filePath: string): string {
  return filePath.toLowerCase().replaceAll("\\", "/");
}

function detectContextFromPath(filePath: string): string | null {
  const parts = normalizePath(filePath).split("/");
  const contextsIndex = parts.lastIndexOf("contexts");

  if (contextsIndex !== -1 && parts[contextsIndex + 1]) {
    return parts[contextsIndex + 1] ?? null;
  }

  const layerKeywords = new Set(["domain", "application", "infrastructure"]);
  const idx = parts.findIndex((part) => layerKeywords.has(part));
  if (idx <= 0) return null;
  return parts[idx - 1] ?? null;
}

function toAuditFinding(
  category: AuditCategoryKey,
  code: string,
  severity: AuditSeverity,
  message: string,
  recommendation: string,
  filePath?: string,
): InternalAuditFinding {
  return {
    ruleId: RULE_IDS_BY_CODE[code] ?? DEFAULT_RULE_ID,
    category,
    code,
    severity,
    message,
    filePath,
    recommendation,
  };
}

function estimateTechnicalDebtDays(findings: InternalAuditFinding[]): number {
  const debt = findings.reduce(
    (total, finding) => total + debtDaysForCode(finding.code),
    0,
  );
  return Number(debt.toFixed(1));
}

function findNodeByImport(
  importPath: string,
  sourceFilePath: string,
  nodes: ArchitectureNode[],
): ArchitectureNode | undefined {
  if (!importPath.startsWith(".")) return undefined;

  const importNoExt = importPath.replace(/\.(ts|tsx|d\.ts)$/, "");
  const sourceDir = path.dirname(path.resolve(sourceFilePath));
  const resolvedImport = path.resolve(sourceDir, importNoExt).toLowerCase();

  return nodes.find((node) => {
    const nodePathNoExt = path
      .resolve(node.filePath)
      .replace(/\.(ts|tsx|d\.ts)$/, "")
      .toLowerCase();

    return (
      nodePathNoExt === resolvedImport ||
      nodePathNoExt === resolvedImport + "/index"
    );
  });
}

function parseDependencyToken(token: string):
  | { type: "layer"; value: ArchitectureNode["layer"] }
  | { type: "kind"; value: ArchitectureNode["kind"] }
  | null {
  const normalized = token.trim().toLowerCase();

  const layerAliases: Record<string, ArchitectureNode["layer"]> = {
    infra: "infrastructure",
    infrastructure: "infrastructure",
    app: "application",
    application: "application",
    domain: "domain",
    "adapter-in": "adapter-in",
    "adapter-out": "adapter-out",
  };

  const kindAliases: Record<string, ArchitectureNode["kind"]> = {
    controller: "controller",
    repository: "repository",
    port: "port",
    usecase: "use-case",
    "use-case": "use-case",
    service: "service",
    entity: "entity",
    module: "module",
    adapter: "adapter",
  };

  if (layerAliases[normalized]) {
    return { type: "layer", value: layerAliases[normalized] };
  }

  if (kindAliases[normalized]) {
    return { type: "kind", value: kindAliases[normalized] };
  }

  return null;
}

function isForbiddenDependencyMatch(
  source: ArchitectureNode,
  target: ArchitectureNode,
  pattern: string,
): boolean {
  const [rawLeft, rawRight] = pattern.split("->").map((item) => item.trim());
  if (!rawLeft || !rawRight) return false;

  const left = parseDependencyToken(rawLeft);
  const right = parseDependencyToken(rawRight);
  if (!left || !right) return false;

  const leftMatches = left.type === "layer"
    ? source.layer === left.value
    : source.kind === left.value;

  const rightMatches = right.type === "layer"
    ? target.layer === right.value
    : target.kind === right.value;

  return leftMatches && rightMatches;
}

function buildFindingsFromBaseViolations(violations: RuleViolation[]): InternalAuditFinding[] {
  const findings: InternalAuditFinding[] = [];

  for (const violation of violations) {
    if (
      violation.message.includes("Domain must not depend on infrastructure") ||
      violation.message.includes("Domain must not depend on application") ||
      violation.message.includes("Application must not depend on infrastructure")
    ) {
      findings.push(
        toAuditFinding(
          "dependencyDirection",
          "dependency-direction",
          "ERROR",
          violation.message,
          "Enforce inward dependency flow: infrastructure -> application -> domain through ports and interfaces.",
          violation.filePath,
        ),
      );
      continue;
    }

    if (violation.message.includes("Cross-context dependency")) {
      findings.push(
        toAuditFinding(
          "dependencyDirection",
          "cross-context-coupling",
          "WARNING",
          violation.message,
          "Use anti-corruption layers or shared ports for cross-context communication.",
          violation.filePath,
        ),
      );
      continue;
    }

    if (
      violation.message.includes("must not depend on frameworks") ||
      violation.message.includes("must not depend on ORM") ||
      violation.message.includes("must live in") ||
      violation.message.includes("must not live in")
    ) {
      findings.push(
        toAuditFinding(
          "layerIsolation",
          "layer-boundary",
          violation.severity === "critical" ? "ERROR" : "WARNING",
          violation.message,
          "Keep each layer isolated: put domain constructs in domain and wire adapters in infrastructure.",
          violation.filePath,
        ),
      );
    }
  }

  return findings;
}

function buildDirectDependencyFindings(
  nodes: ArchitectureNode[],
  config: AuditEngineConfig,
): InternalAuditFinding[] {
  const findings: InternalAuditFinding[] = [];

  for (const source of nodes) {
    for (const imp of source.imports) {
      const target = findNodeByImport(imp, source.filePath, nodes);
      if (!target) continue;

      if (source.kind === "controller" && target.kind === "repository") {
        findings.push(
          toAuditFinding(
            "dddPatterns",
            "controller-repository-coupling",
            "ERROR",
            "Controller directly depends on repository implementation",
            "Controllers should invoke use cases; repositories should be consumed by application services via ports.",
            source.filePath,
          ),
        );
      }

      for (const pattern of config.rules.forbiddenDependencies) {
        if (!isForbiddenDependencyMatch(source, target, pattern)) continue;

        findings.push(
          toAuditFinding(
            "dependencyDirection",
            "forbidden-dependency",
            "ERROR",
            `Forbidden dependency detected: ${pattern}`,
            "Refactor the dependency to follow configured architecture constraints.",
            source.filePath,
          ),
        );
      }
    }
  }

  return findings;
}

function buildNamingFindings(nodes: ArchitectureNode[]): InternalAuditFinding[] {
  const findings: InternalAuditFinding[] = [];

  for (const node of nodes) {
    if (node.kind === "use-case" && !node.name.endsWith("UseCase")) {
      findings.push(
        toAuditFinding(
          "namingConventions",
          "usecase-name",
          "INFO",
          `Use case should end with 'UseCase': ${node.name}`,
          "Rename application services to <Action><Entity>UseCase for consistency and discoverability.",
          node.filePath,
        ),
      );
    }

    if (node.kind === "controller" && !node.name.endsWith("Controller")) {
      findings.push(
        toAuditFinding(
          "namingConventions",
          "controller-name",
          "INFO",
          `Controller should end with 'Controller': ${node.name}`,
          "Use <Resource>Controller naming for adapter-in classes.",
          node.filePath,
        ),
      );
    }

    if (node.kind === "repository" && !node.name.endsWith("Repository")) {
      findings.push(
        toAuditFinding(
          "namingConventions",
          "repository-name",
          "INFO",
          `Repository should end with 'Repository': ${node.name}`,
          "Use explicit repository names to make persistence adapters identifiable.",
          node.filePath,
        ),
      );
    }

    if (node.kind === "port" && !node.name.endsWith("Port")) {
      findings.push(
        toAuditFinding(
          "namingConventions",
          "port-name",
          "INFO",
          `Port interface should end with 'Port': ${node.name}`,
          "Use *Port naming in domain contracts for consistent dependency inversion.",
          node.filePath,
        ),
      );
    }
  }

  return findings;
}

function buildFolderStructureFindings(
  projectPath: string,
  nodes: ArchitectureNode[],
): InternalAuditFinding[] {
  const findings: InternalAuditFinding[] = [];

  const coreConfig = loadConfig(projectPath);
  const contextsRoot = path.resolve(projectPath, coreConfig.contextsDir);
  const contexts = new Set<string>();

  for (const node of nodes) {
    const context = detectContextFromPath(node.filePath);
    if (context) contexts.add(context);
  }

  for (const context of [...contexts].sort((left, right) => left.localeCompare(right))) {
    const contextRoot = path.join(contextsRoot, context);
    const requiredDirectories = ["domain", "application", "infrastructure"];

    for (const requiredDir of requiredDirectories) {
      const absoluteDir = path.join(contextRoot, requiredDir);
      if (fs.existsSync(absoluteDir)) continue;

      findings.push(
        toAuditFinding(
          "folderStructure",
          "missing-layer-directory",
          "ERROR",
          `Context '${context}' is missing '${requiredDir}' directory`,
          "Create the standard hexagonal folders: domain, application, and infrastructure.",
          absoluteDir,
        ),
      );
    }
  }

  return findings;
}

function buildDddFindings(
  nodes: ArchitectureNode[],
  config: AuditEngineConfig,
): InternalAuditFinding[] {
  const findings: InternalAuditFinding[] = [];

  const contexts = new Map<
    string,
    {
      hasEntity: boolean;
      hasPort: boolean;
      hasUseCase: boolean;
      hasController: boolean;
    }
  >();

  for (const node of nodes) {
    const context = detectContextFromPath(node.filePath);
    if (!context) continue;

    const current = contexts.get(context) ?? {
      hasEntity: false,
      hasPort: false,
      hasUseCase: false,
      hasController: false,
    };

    if (node.kind === "entity") current.hasEntity = true;
    if (node.kind === "port" && node.layer === "domain") current.hasPort = true;
    if (node.kind === "use-case") current.hasUseCase = true;
    if (node.kind === "controller") current.hasController = true;

    contexts.set(context, current);
  }

  for (const [context, info] of [...contexts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (!info.hasEntity) {
      findings.push(
        toAuditFinding(
          "dddPatterns",
          "missing-entity",
          "WARNING",
          `Context '${context}' has no detected entity`,
          "Define aggregate roots/entities in domain/entities to model core business concepts.",
        ),
      );
    }

    if (config.rules.enforcePorts && !info.hasPort) {
      findings.push(
        toAuditFinding(
          "dddPatterns",
          "missing-port",
          "ERROR",
          `Context '${context}' has no domain port`,
          "Create domain ports to invert dependencies between application and infrastructure layers.",
        ),
      );
    }

    if (config.rules.enforceUseCases && info.hasController && !info.hasUseCase) {
      findings.push(
        toAuditFinding(
          "dddPatterns",
          "missing-usecase",
          "ERROR",
          `Context '${context}' has controller(s) but no use case`,
          "Isolate orchestration in application/use-cases and route controller actions through use cases.",
        ),
      );
    }
  }

  return findings;
}

function buildDebtBreakdown(findings: InternalAuditFinding[]): DebtBreakdown {
  const byContext: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let total = 0;

  for (const finding of findings) {
    const days = debtDaysForCode(finding.code);
    total += days;

    byCategory[finding.category] = Number(
      ((byCategory[finding.category] ?? 0) + days).toFixed(1),
    );

    const context = finding.filePath
      ? detectContextFromPath(finding.filePath)
      : null;
    const ctxKey = context ?? "__global";
    byContext[ctxKey] = Number(
      ((byContext[ctxKey] ?? 0) + days).toFixed(1),
    );
  }

  const topViolations = [...findings]
    .map((f) => ({
      ruleId: f.ruleId,
      code: f.code,
      message: f.message,
      debtDays: debtDaysForCode(f.code),
      filePath: f.filePath,
    }))
    .sort((a, b) => b.debtDays - a.debtDays)
    .slice(0, 5);

  return {
    total: Number(total.toFixed(1)),
    byContext,
    byCategory,
    topViolations,
  };
}

function scoreCategory(findings: InternalAuditFinding[], weight: number): number {
  const penalty = findings.reduce((total, finding) => total + PENALTY_BY_SEVERITY[finding.severity], 0);
  const clampedPenalty = Math.min(weight, penalty);
  return Math.max(weight - clampedPenalty, 0);
}

function toStatus(findings: InternalAuditFinding[]): AuditStatus {
  if (findings.some((finding) => finding.severity === "ERROR")) return "ERROR";
  if (findings.length > 0) return "WARNING";
  return "OK";
}

function dedupeFindings(findings: InternalAuditFinding[]): InternalAuditFinding[] {
  const map = new Map<string, InternalAuditFinding>();

  for (const finding of findings) {
    const key = [
      finding.category,
      finding.code,
      finding.severity,
      finding.message,
      finding.filePath ?? "",
    ].join("|");

    if (!map.has(key)) {
      map.set(key, finding);
    }
  }

  return [...map.values()];
}

function normalizeIgnoredRules(ignoredRules: string[]): Set<string> {
  return new Set(ignoredRules.map((ruleId) => ruleId.trim().toUpperCase()));
}

function collectInlineSuppressions(filePath: string): Set<string> {
  const suppressed = new Set<string>();

  if (!fs.existsSync(filePath)) return suppressed;

  const content = fs.readFileSync(filePath, "utf8");
  const regex = /node-hexa-ignore\s+([^\n\r]+)/g;
  let match = regex.exec(content);

  while (match) {
    const section = match[1] ?? "";
    const ids = section.match(/NXH\d{3}/g) ?? [];
    for (const id of ids) {
      suppressed.add(id.toUpperCase());
    }
    match = regex.exec(content);
  }

  return suppressed;
}

function applySuppressions(
  findings: InternalAuditFinding[],
  ignoredRuleIds: string[],
): InternalAuditFinding[] {
  if (findings.length === 0) return findings;

  const globalIgnored = normalizeIgnoredRules(ignoredRuleIds);
  const fileSuppressionCache = new Map<string, Set<string>>();

  return findings.filter((finding) => {
    if (globalIgnored.has(finding.ruleId)) return false;
    if (!finding.filePath) return true;

    if (!fileSuppressionCache.has(finding.filePath)) {
      fileSuppressionCache.set(finding.filePath, collectInlineSuppressions(finding.filePath));
    }

    const suppressedForFile = fileSuppressionCache.get(finding.filePath);
    return !suppressedForFile?.has(finding.ruleId);
  });
}

export function buildArchitectureAuditReport(
  projectPath: string,
  analysis: AuditAnalysisInput,
): ArchitectureAuditReport {
  const config = loadAuditEngineConfig(projectPath);
  const nodes = analysis.model.nodes;

  // A project is considered hexagonal when at least one analysed file lives
  // inside a `contexts/` directory — the canonical DDD hexagonal layout.
  const hasHexagonalStructure = nodes.some(
    (node) => detectContextFromPath(node.filePath) !== null,
  );

  if (!hasHexagonalStructure) {
    // Return a minimal sentinel report so callers can detect and handle the
    // "not a hexagonal project" case without crashing on missing fields.
    const emptyBreakdown: DebtBreakdown = {
      total: 0,
      byContext: {},
      byCategory: {},
      topViolations: [],
    };
    return {
      score: 0,
      maxScore: 100,
      estimatedTechnicalDebtDays: 0,
      categoryScores: {
        dependencyDirection: 0,
        layerIsolation: 0,
        namingConventions: 0,
        folderStructure: 0,
        dddPatterns: 0,
      },
      dddCompliance: "OK",
      hexagonalBoundaries: "OK",
      dependencyViolations: "OK",
      findings: [],
      recommendations: [],
      config,
      debtBreakdown: emptyBreakdown,
      notHexagonal: true,
    };
  }

  const dedupedFindings = dedupeFindings([
    ...buildFindingsFromBaseViolations(analysis.violations),
    ...buildDirectDependencyFindings(nodes, config),
    ...buildNamingFindings(nodes),
    ...buildFolderStructureFindings(projectPath, nodes),
    ...buildDddFindings(nodes, config),
  ]);

  const findings = applySuppressions(
    dedupedFindings,
    config.rules.ignoredRules,
  ).sort((a, b) => {
    const severityDiff = FINDING_ORDER[a.severity] - FINDING_ORDER[b.severity];
    if (severityDiff !== 0) return severityDiff;

    const pathA = a.filePath ?? "";
    const pathB = b.filePath ?? "";
    if (pathA !== pathB) return pathA.localeCompare(pathB);

    return a.message.localeCompare(b.message);
  });

  const byCategory = (category: AuditCategoryKey) =>
    findings.filter((finding) => finding.category === category);

  const categoryScores: CategoryScores = {
    dependencyDirection: scoreCategory(byCategory("dependencyDirection"), CATEGORY_WEIGHTS.dependencyDirection),
    layerIsolation: scoreCategory(byCategory("layerIsolation"), CATEGORY_WEIGHTS.layerIsolation),
    namingConventions: scoreCategory(byCategory("namingConventions"), CATEGORY_WEIGHTS.namingConventions),
    folderStructure: scoreCategory(byCategory("folderStructure"), CATEGORY_WEIGHTS.folderStructure),
    dddPatterns: scoreCategory(byCategory("dddPatterns"), CATEGORY_WEIGHTS.dddPatterns),
  };

  const score = Object.values(categoryScores).reduce((sum, value) => sum + value, 0);

  const recommendations = [...new Set(findings.map((finding) => finding.recommendation))];
  const estimatedTechnicalDebtDays = estimateTechnicalDebtDays(findings);

  return {
    score,
    maxScore: 100,
    estimatedTechnicalDebtDays,
    categoryScores,
    dddCompliance: toStatus(byCategory("dddPatterns")),
    hexagonalBoundaries: toStatus([
      ...byCategory("layerIsolation"),
      ...byCategory("folderStructure"),
    ]),
    dependencyViolations: toStatus(byCategory("dependencyDirection")),
    findings: findings.map((finding) => ({
      ruleId: finding.ruleId,
      category: mapRuleCategory(finding.category),
      code: finding.code,
      severity: finding.severity,
      message: finding.message,
      filePath: finding.filePath,
    })),
    recommendations,
    config,
    debtBreakdown: buildDebtBreakdown(findings),
  };
}

export function createAuditBaseline(report: ArchitectureAuditReport): AuditBaseline {
  const ruleIds = [...new Set(report.findings.map((finding) => finding.ruleId))];

  return {
    score: report.score,
    violations: report.findings,
    ruleIds,
    timestamp: new Date().toISOString(),
  };
}

export function writeAuditBaseline(
  report: ArchitectureAuditReport,
  projectPath: string,
): string {
  const baseline = createAuditBaseline(report);
  const outputPath = path.join(projectPath, "node-hexa-baseline.json");
  fs.writeFileSync(outputPath, JSON.stringify(baseline, null, 2), "utf8");
  return outputPath;
}

export function readAuditBaseline(projectPath: string): AuditBaseline {
  const baselinePath = path.join(projectPath, "node-hexa-baseline.json");
  if (!fs.existsSync(baselinePath)) {
    throw new Error(`Baseline file not found at ${baselinePath}. Run 'node-hexa audit --baseline' first.`);
  }

  const raw = fs.readFileSync(baselinePath, "utf8");
  return JSON.parse(raw) as AuditBaseline;
}

function findingKey(finding: Pick<AuditFinding, "ruleId" | "message" | "filePath">): string {
  return `${finding.ruleId}|${finding.message}|${finding.filePath ?? ""}`;
}

export function compareAuditBaseline(
  baseline: AuditBaseline,
  current: ArchitectureAuditReport,
): AuditBaselineComparison {
  const previous = new Set(baseline.violations.map((violation) => findingKey(violation)));
  const now = new Set(current.findings.map((violation) => findingKey(violation)));

  let unchanged = 0;
  for (const key of now) {
    if (previous.has(key)) unchanged += 1;
  }

  const newViolations = [...now].filter((key) => !previous.has(key)).length;
  const resolvedViolations = [...previous].filter((key) => !now.has(key)).length;
  const delta = current.score - baseline.score;

  return {
    previousScore: baseline.score,
    currentScore: current.score,
    delta,
    newViolations,
    resolvedViolations,
    unchanged,
  };
}

function sarifLevelFromSeverity(severity: AuditSeverity): "error" | "warning" | "note" {
  if (severity === "ERROR") return "error";
  if (severity === "WARNING") return "warning";
  return "note";
}

export function generateAuditSarif(
  report: ArchitectureAuditReport,
  toolVersion: string,
): string {
  const ruleMap = new Map<string, { id: string; name: string; shortDescription: { text: string } }>();

  for (const finding of report.findings) {
    if (!ruleMap.has(finding.ruleId)) {
      ruleMap.set(finding.ruleId, {
        id: finding.ruleId,
        name: finding.category,
        shortDescription: { text: finding.message },
      });
    }
  }

  const results = report.findings.map((finding) => {
    const location = finding.filePath
      ? {
          physicalLocation: {
            artifactLocation: {
              uri: finding.filePath,
            },
            region: {
              startLine: 1,
            },
          },
        }
      : undefined;

    return {
      ruleId: finding.ruleId,
      level: sarifLevelFromSeverity(finding.severity),
      message: {
        text: finding.message,
      },
      locations: location ? [location] : [],
    };
  });

  const sarif = {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "node-hexa",
            version: toolVersion,
            informationUri: "https://github.com/Dawudesign/node-hexa",
            rules: [...ruleMap.values()],
          },
        },
        results,
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function generateAuditHtmlReport(
  report: ArchitectureAuditReport,
  projectPath: string,
): string {
  const outputPath = path.join(projectPath, "node-hexa-report.html");

  const findingsHtml = report.findings.length === 0
    ? "<li>No violations detected.</li>"
    : report.findings
      .map((finding) => {
        const fileInfo = finding.filePath
          ? `<div class="meta">${escapeHtml(finding.filePath)}</div>`
          : "";
        return `<li><strong>[${escapeHtml(finding.ruleId)}][${escapeHtml(finding.severity.toUpperCase())}][${escapeHtml(finding.category)}]</strong> ${escapeHtml(finding.message)}${fileInfo}</li>`;
      })
      .join("\n");

  const recommendationsHtml = report.recommendations.length === 0
    ? "<li>No recommendations.</li>"
    : report.recommendations
      .map((recommendation) => `<li>${escapeHtml(recommendation)}</li>`)
      .join("\n");

  const contextDebtRows = Object.entries(report.debtBreakdown.byContext)
    .sort(([, a], [, b]) => b - a);
  const maxContextDebt = Math.max(...contextDebtRows.map(([, v]) => v), 0.1);

  const contextDebtHtml = contextDebtRows.length === 0
    ? "<p>No context-level debt detected.</p>"
    : contextDebtRows
        .map(([ctx, days]) => {
          const pct = Math.round((days / maxContextDebt) * 100);
          const label = ctx === "__global" ? "(global)" : ctx;
          return `<div class="category"><strong>${escapeHtml(label)}</strong><div style="display:flex;align-items:center;gap:8px;margin-top:6px"><div style="flex:1;background:#e5e7eb;border-radius:4px;height:8px"><div style="width:${pct}%;height:100%;background:#ef4444;border-radius:4px"></div></div><span style="font-size:13px;color:#6b7280">${days}d</span></div></div>`;
        })
        .join("\n");

  const topViolationsDebtHtml = report.debtBreakdown.topViolations.length === 0
    ? "<li>No violations.</li>"
    : report.debtBreakdown.topViolations
        .map(
          (v) =>
            `<li><strong>${escapeHtml(v.code)}</strong> <span style="color:#ef4444;font-weight:700">${v.debtDays}d</span> — ${escapeHtml(v.message)}${v.filePath ? `<div class="meta">${escapeHtml(v.filePath)}</div>` : ""}</li>`,
        )
        .join("\n");

  const rulesHtml = [
    "Dependency direction correctness: domain/application must not depend outward",
    "Layer isolation: framework and component placement boundaries must be respected",
    "Naming conventions: strategic class naming for ports/use cases/controllers/repositories",
    "Folder structure: each context should contain domain/application/infrastructure",
    "DDD patterns: entities, ports, and use cases must be present according to policy",
  ]
    .map((rule) => `<li>${escapeHtml(rule)}</li>`)
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Node Hexa Architecture Report</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7fb;
      --card: #ffffff;
      --text: #1f2a37;
      --muted: #6b7280;
      --accent: #1d4ed8;
      --border: #d1d5db;
    }
    body {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
      color: var(--text);
    }
    .wrap {
      max-width: 980px;
      margin: 0 auto;
      padding: 24px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 6px 20px rgba(15, 23, 42, 0.06);
    }
    h1, h2 {
      margin: 0 0 12px;
    }
    h1 {
      font-size: 30px;
      letter-spacing: 0.02em;
    }
    h2 {
      font-size: 20px;
      color: var(--accent);
    }
    .score {
      font-size: 44px;
      font-weight: 700;
      margin: 8px 0;
    }
    .status-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .status {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px;
      background: #f9fafb;
    }
    .status strong {
      display: block;
      margin-bottom: 4px;
    }
    ul {
      margin: 8px 0 0;
      padding-left: 20px;
    }
    li {
      margin: 6px 0;
    }
    .meta {
      color: var(--muted);
      font-size: 13px;
      margin-top: 2px;
    }
    .category-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .category {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px;
      background: #f8fafc;
      font-size: 14px;
    }
    @media (max-width: 760px) {
      .status-row,
      .category-grid {
        grid-template-columns: 1fr;
      }
      .score {
        font-size: 36px;
      }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="card">
      <h1>Node Hexa Architecture Report</h1>
      <div class="score">${report.score}/${report.maxScore}</div>
      <div>Estimated technical debt: ${report.estimatedTechnicalDebtDays} days</div>
      <div>Quality Gate: minimum ${report.config.qualityGate.minScore}</div>
      <div class="status-row" style="margin-top: 14px;">
        <div class="status"><strong>DDD compliance</strong>${report.dddCompliance}</div>
        <div class="status"><strong>Hexagonal boundaries</strong>${report.hexagonalBoundaries}</div>
        <div class="status"><strong>Dependency violations</strong>${report.dependencyViolations}</div>
      </div>
    </section>

    <section class="card">
      <h2>Category Scores</h2>
      <div class="category-grid">
        <div class="category">Dependency direction: ${report.categoryScores.dependencyDirection}/35</div>
        <div class="category">Layer isolation: ${report.categoryScores.layerIsolation}/25</div>
        <div class="category">Naming conventions: ${report.categoryScores.namingConventions}/15</div>
        <div class="category">Folder structure: ${report.categoryScores.folderStructure}/15</div>
        <div class="category">DDD patterns: ${report.categoryScores.dddPatterns}/10</div>
      </div>
    </section>

    <section class="card">
      <h2>Technical Debt</h2>
      <div style="font-size:14px;color:#6b7280;margin-bottom:12px">Total: <strong style="color:#1e293b">${report.estimatedTechnicalDebtDays} engineer-days</strong></div>
      <h3 style="font-size:14px;margin:0 0 8px">By Bounded Context</h3>
      ${contextDebtHtml}
      <h3 style="font-size:14px;margin:16px 0 8px">Top Violations</h3>
      <ul>
        ${topViolationsDebtHtml}
      </ul>
    </section>

    <section class="card">
      <h2>Detected Problems</h2>
      <ul>
        ${findingsHtml}
      </ul>
    </section>

    <section class="card">
      <h2>Rule Explanations</h2>
      <ul>
        ${rulesHtml}
      </ul>
    </section>

    <section class="card">
      <h2>Improvement Suggestions</h2>
      <ul>
        ${recommendationsHtml}
      </ul>
    </section>
  </div>
</body>
</html>`;

  fs.writeFileSync(outputPath, html, "utf8");
  return outputPath;
}

function badgeColor(score: number): string {
  if (score >= 90) return "#2ea043";
  if (score >= 75) return "#bf8700";
  return "#cf222e";
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function generateAuditBadgeSvg(
  report: ArchitectureAuditReport,
  projectPath: string,
): string {
  const outputPath = path.join(projectPath, "node-hexa-score.svg");
  const title = "Node Hexa Architecture Score";
  const value = `${report.score}/${report.maxScore}`;
  const width = 280;
  const height = 56;
  const color = badgeColor(report.score);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img" aria-label="${escapeXml(title)} ${escapeXml(value)}">
  <rect width="${width}" height="${height}" rx="8" fill="#0f172a"/>
  <rect x="6" y="6" width="${width - 12}" height="${height - 12}" rx="6" fill="#111827" stroke="${color}" stroke-width="2"/>
  <text x="${Math.round(width / 2)}" y="24" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="12" fill="#e5e7eb">${escapeXml(title)}</text>
  <text x="${Math.round(width / 2)}" y="42" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="18" font-weight="700" fill="${color}">${escapeXml(value)}</text>
</svg>`;

  fs.writeFileSync(outputPath, svg, "utf8");
  return outputPath;
}